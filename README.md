# RDA Lock Client

Client for the RDA Lock Service. Lets you get atomic locks on resources and wait 
for locks that are currently busy.


## API

An instance of a Lock which is returned by the factor method createLock can be 
used for locking one resource once. It has a strict lifecycle which makes sure 
that no resource can be locked twice over all of the RDA services.


```javascript
import LockClient from '@infect/rda-lock-client';

// create a client that can talk to the service
const client = new LockClient({
    serviceRegistryHost: 'http://l.dns.porn:9000'
});

// get a lock for a resource
const lock = client.createLock('my-resource')

// wait until the lock could be created
await lock.lock();

// do your stuff on the resource you just locked
console.log('working hard!');

// free the lock, let others work on the resource
await lock.free();
```


### LockClient.constructor

Sets up a lock client. Needs some way to access the service registry in order
to be able to contact the lock service. You need to either pass the registry
host or an instance of a [registry client](https://www.npmjs.com/package/@infect/rda-service-registry-client)

```javascript
// create a client that can talk to the service
const client = new LockClient({
    serviceRegistryHost: 'http://l.dns.porn:9000',
    registryClient,
});
```


### LockClient.creteLock

Factory method creating a new instance of the Lock class which represents one
locking cycle for one resource. Needs a resource id to lock and takes optionally
some options:

- ttl: defines how long the lock persists if the lock client stops refreshing the locks (seconds)
- timeout: how long to wait until a lock can be established (seconds)
- keepAlie: boolean defining if the client should keep alive the lock in order to not run into the ttl

Returns an instance of the Lock class.

```javascript
const client = new LockClient({
    serviceRegistryHost: 'http://l.dns.porn:9000',
    registryClient,
});
```


### async Lock.lock()

Lock the resource specified in the call to the LockClient.createLock method. 
wait until the lock could be acquired or the timeout is reached. Locking may
not be possible because other lock instances occupy the resource already.

throws an error when the timeout is reached.

```javascript
await lock.lock();
```



### async Lock.free()

Free the resource again, let others create a lock on it.

```javascript
await lock.free();
```


