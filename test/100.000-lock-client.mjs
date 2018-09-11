import assert from 'assert';
import section from 'section-tests';
import ServiceManager from '@infect/rda-service-manager';
import LockClient from '../src/LockClient.mjs';



section('RDA Lock Client', (section) => {
    let sm;

    section.setup(async() => {
        sm = new ServiceManager({
            args: '--dev --log-level=error+ --log-module=*'.split(' '),
        });

        await sm.startServices('rda-service-registry');
        await sm.startServices('rda-lock');
    });



    section.test('Lock and unlock a resource', async() => {
        const resourceId = `lock-test-${Math.random()}`;
        const client = new LockClient({
            serviceRegistryHost: 'http://l.dns.porn:9000',
        });

        const lock = client.createLock(resourceId);
        await lock.lock();
        await lock.free();
    });



    section.test('Attempt a double lock on the same lock instance', async() => {
        const resourceId = `lock-test-${Math.random()}`;
        let err;

        const client = new LockClient({
            serviceRegistryHost: 'http://l.dns.porn:9000',
        });
        const lock = client.createLock(resourceId);

        await lock.lock();
        await lock.lock().then(() => {
            throw new Error('the lock should have failed!');
        }).catch((e) => {
            err = e;
        });

        assert(err);

        await lock.free();
    });



    section.test('Attempt a double lock on a different instance', async() => {
        const resourceId = `lock-test-${Math.random()}`;
        let err;

        const client = new LockClient({
            serviceRegistryHost: 'http://l.dns.porn:9000',
        });
        const lock = client.createLock(resourceId);
        await lock.lock();

        const lock2 = client.createLock(resourceId, {
            timeout: 1,
        });
        await lock2.lock().then(() => {
            throw new Error('the lock should have failed!');
        }).catch((e) => {
            err = e;
        });

        assert(err);


        await lock.free();
    });


    section.test('Wait on a lock to become available', async() => {
        section.setTimeout(5000);

        const resourceId = `lock-test-${Math.random()}`;

        const client = new LockClient({
            serviceRegistryHost: 'http://l.dns.porn:9000',
        });
        const lock = client.createLock(resourceId);

        await lock.lock();

        setTimeout(() => {
            lock.free();
        });

        const lock2 = client.createLock(resourceId);

        await lock2.lock();
        await lock2.free();
    });


    section.test('Adopt a lock', async() => {
        section.setTimeout(5000);

        const resourceId = `lock-test-${Math.random()}`;

        const client = new LockClient({
            serviceRegistryHost: 'http://l.dns.porn:9000',
        });
        const lock = client.createLock(resourceId, { keepAlive: false });

        await lock.lock();

        const adoptedLock = client.adoptLock(lock.getId());

        await adoptedLock.free();
    });



    section.destroy(async() => {
        await sm.stopServices();
    });
});
