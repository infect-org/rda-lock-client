import HTT2Client from '@distributed-systems/http2-client';
import Delay from '@distributed-systems/delay';
import log from 'ee-log';


// the lock will go through most of the stages in the list below. most of the methods work only
// only if a certain status is set. also: the status can never be set to a status with a lower or
// the same code as the current status.
const lockStatusMap = new Map([
    ['initialized', 100],
    ['acquiring', 200],
    ['acquired', 300],
    ['freeing', 400],
    ['freed', 500],
    ['canceled', 850],
    ['timeout', 900],
    ['failed', 999],
]);




/**
 * Interface for the lock service. Lets you create, keep and free locks.
 */
export default class Lock {


    /**
     * set up the the lock class
     *
     * @param      {Object}                 arg1                      options
     * @param      {boolean}                arg1.keepAlive            should the lock be kept alive
     *                                                                in order to prevent hitting
     *                                                                the TTL?
     * @param      {ServiceRegistryClient}  arg1.registryClient       instance of the service
     *                                                                registry client
     * @param      {string}                 arg1.resourceId           The resource identifier
     * @param      {string}                 arg1.serviceRegistryHost  host to the service registry
     * @param      {number}                 arg1.timeout              how long to wait until a lock
     *                                                                can be acquired. seconds
     * @param      {number}                 arg1.ttl                  ttl for the lock. the lock is
     *                                                                removed if the ttl is reached.
     *                                                                seconds.
     */
    constructor({
        keepAlive = true,
        lockId,
        registryClient,
        resourceId,
        timeout = 60,
        ttl = 30,
    }) {
        if (registryClient) {
            this.registryClient = registryClient;
        } else {
            throw new Error('Please provide a \'registryClient\' instance!');
        }


        if (lockId) {
            // lock adoption. assume that it was acquired already

            this.lockId = lockId;
            this.currentStatusName = 'acquired';
            this.currentStatus = lockStatusMap.get(this.currentStatusName);
        } else {
            if (typeof resourceId !== 'string') {
                throw new Error('Please provide a \'resourceId\' string!');
            }

            this.resourceId = resourceId;
            this.setStatus('initialized');
        }


        // set up a global http2 client for fast request processing
        this.httpClient = new HTT2Client();



        this.ttl = ttl;
        this.timeout = timeout;
        this.doKeepAlive = keepAlive;

        // indicates how many times a call was sent to the lock service
        // in order to acquire a lock. is used to back off exponentially
        this.lockCallCount = 0;

        // factor that is used to calculate the back off time
        this.backOffFactor = 1.3;

        // the upper limit for the iteration count when calculating the
        // back off time. An upper bound of 15 with a factor of 1.3 will
        // result in maximum pause of ~51 seconds (1.3**15 => 51.18)
        this.backOffUpperBound = 15;
    }





    /**
     * indicates if the lock was acquired
     *
     * @return     {boolean}  True if acquired, False otherwise.
     */
    isAcquired() {
        return !!this.lockId;
    }






    /**
     * return the lock id if it is available
     *
     * @return     {number}  the locks id
     */
    getId() {
        if (this.isAcquired()) return this.lockId;
        else throw new Error(`Cannot get lock id: the lock was not yet aquired. The locks status is ${this.currentStatusName}`);
    }






    /**
     * acquired a lock for the resource passed to the constructor
     *
     * @return     {Promise}  this
     */
    async lock() {

        // this will throw if the current status is not viable
        this.setStatus('acquiring');

        // remember where we started to acquire the lock so that
        // the timeout can be respected
        const lockStart = Date.now();


        // try to get a lock as long the timeout is not reached
        while ((lockStart + (this.timeout * 1000)) > Date.now()) {
            const lockId = await this.tryToLock();

            if (lockId) {

                // the lock could have been canceled while the request was sent
                // to the service, if that's the case, free the lock immediately
                if (this.currentStatus > lockStatusMap.get('acquired')) {
                    await this.free(true);
                } else {
                    this.setStatus('acquired');
                    this.lockId = lockId;
                }

                break;
            }

            // back off and try again
            const iterationCount = Math.min(this.backOffUpperBound, this.lockCallCount);
            this.tryLockTimeout = new Delay();
            await this.tryLockTimeout.wait((this.backOffFactor ** iterationCount) * 1000);
        }


        if (this.currentStatusName === 'acquired') {
            if (this.doKeepAlive) {

                // make sure errors are logged here!
                this.keepAlive().catch(log);
            }
        } else {
            this.setStatus('timeout');
            throw new Error(`Failed to acquire lock, the timeout of ${this.timeout} was encountered!`);
        }
    }





    /**
     * cancel the lock. frees the lock if it was acquired already
     *
     * @return     {Promise}  undefined
     */
    async cancel() {
        if (this.currentStatusName === 'acquired') {
            await this.free();
        }

        // if the lock is in the process of being created cancel that process
        if (this.tryLockTimeout) {
            this.tryLockTimeout.cancel();
        }
    }






    /**
     * free the lock
     *
     * @param      {boolean}  ignoreStatus  don't check for a valid status
     * @return     {Promise}  undefined
     */
    async free(ignoreStatus = false) {
        if (!ignoreStatus && this.currentStatusName !== 'acquired') {
            throw new Error(`Cannot free lock: invalid status ${this.currentStatusName}`);
        }

        // cancel the keep alive process
        if (this.keepAliveTimeout) {
            this.keepAliveTimeout.cancel();
        }

        this.setStatus('freeing');

        const lockServiceHost = await this.registryClient.resolve('rda-lock');

        await this.httpClient.delete(`${lockServiceHost}/rda-lock.lock/${this.lockId}`)
            .expect(200)
            .send().catch((err) => {
                this.setStatus('failed');
                throw err;
            });

        this.setStatus('freed');
    }







    /**
     * keeps the lock alive on the service by preventing a TTL hit
     *
     * @private
     *
     * @return     {Promise}  undefined
     */
    async keepAlive() {

        // wait two thirds of the TTL for refreshing the lock
        const timeoutTime = Math.round(this.ttl * 0.66 * 1000);
        this.keepAliveTimeout = new Delay();
        await this.keepAliveTimeout.wait(timeoutTime);

        const lockServiceHost = await this.registryClient.resolve('rda-lock');
        await this.httpClient.patch(`${lockServiceHost}/rda-lock.lock/${this.lockId}`)
            .expect(200)
            .send().catch((err) => {
                this.setStatus('failed');
                throw err;
            });
    }







    /**
     * try to acquire to get a lock
     *
     * @private
     *
     * @return     {Promise}  lock id or undefined if the lock could not be acquired
     */
    async tryToLock() {

        // get a fresh URL to the lock service each time because
        // lock service instances could go down
        const lockServiceHost = await this.registryClient.resolve('rda-lock');
        const lockResponse = await this.httpClient.post(`${lockServiceHost}/rda-lock.lock`)
            .expect(201, 409)
            .send({
                ttl: this.ttl,
                identifier: this.resourceId,
            });


        if (lockResponse.status(201)) {
            const data = await lockResponse.getData();

            if (!data || !data.id) {
                throw new Error('Error while locking resource! Lock service returned insufficient data!');
            }

            return data.id;
        }
    }







    /**
     * set the current status of the lock
     *
     * @private
     *
     * @param      {string}  statusName  The status name
     */
    setStatus(statusName) {
        if (!lockStatusMap.has(statusName)) {
            this.setStatus('failed');
            throw new Error(`Cannot set status: the status '${statusName}' is invalid!`);
        }

        const status = lockStatusMap.get(statusName);

        // make sure the new status has a higher value than the current one
        if (this.currentStatus && this.currentStatus >= status) {
            throw new Error(`Cannot set status: the current status '${this.currentStatusName}'(${this.currentStatus}) is lower or equal to the status to be set '${statusName}(${status})!`);
        }

        this.currentStatus = status;
        this.currentStatusName = statusName;
    }
}
