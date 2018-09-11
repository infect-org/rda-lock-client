import RegistryClient from '@infect/rda-service-registry-client';
import Lock from './Lock.mjs';




/**
 * Factory class for creating lcoks
 */
export default class LockClient {


    /**
     * set up the the lock class
     *
     * @param      {Object}                 arg1                      options
     * @param      {ServiceRegistryClient}  arg1.registryClient       instance of the service
     *                                                                registry client
     * @param      {string}                 arg1.serviceRegistryHost  host to the service registry
     */
    constructor({
        registryClient,
        serviceRegistryHost,
    }) {
        if (registryClient) {
            this.registryClient = registryClient;
        } else if (serviceRegistryHost) {
            this.registryClient = new RegistryClient(serviceRegistryHost);
        } else {
            throw new Error('Please provide either a \'registryClient\' instance or the \'serviceRegistryHost\' URL!');
        }
    }




    /**
     * factory method used to create locks
     *
     * @param      {string}   resourceId      the name of the resource to lock
     * @param      {Object}   arg2            options
     * @param      {number}   arg2.ttl        ttl for the lock. the lock is removed if the ttl is
     *                                        reached. seconds
     * @param      {number}   arg2.timeout    how long to wait until a lock can be acquired. seconds
     * @param      {boolean}  arg2.keepAlive  should the lock be kept alive in order to prevent
     *                                        hitting the TTL?
     * @return     {Lock}     Lock instance
     */
    createLock(resourceId, {
        ttl = 30,
        timeout = 60,
        keepAlive = true,
    } = {}) {
        return new Lock({
            keepAlive,
            registryClient: this.registryClient,
            resourceId,
            timeout,
            ttl,
        });
    }





    /**
     * adopt a already created lock, lets you cancel or free it. be aware that this method doesn't
     * validate the status or existence of the lock, so you may run into interesting problems. The
     * client just assumes that the lock has the status acquired
     *
     * @param      {<type>}   lockId          The lock id
     * @param      {Object}   arg2            options
     * @param      {number}   arg2.ttl        ttl for the lock. the lock is removed if the ttl is
     *                                        reached. seconds
     * @param      {number}   arg2.timeout    how long to wait until a lock can be acquired. seconds
     * @param      {boolean}  arg2.keepAlive  should the lock be kept alive in order to prevent
     *                                        hitting the TTL?
     * @return     {Lock}     the lock instance
     */
    adoptLock(lockId, {
        ttl = 30,
        timeout = 60,
        keepAlive = true,
    } = {}) {
        return new Lock({
            keepAlive,
            lockId,
            registryClient: this.registryClient,
            timeout,
            ttl,
        });
    }
}
