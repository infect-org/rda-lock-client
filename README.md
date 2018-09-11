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


### LockClient.createLock

Factory method creating a new instance of the Lock class which represents one
locking cycle for one resource. Needs a resource id to lock and takes optionally
some options:

- ttl: defines how long the lock persists if the lock client stops refreshing the locks (seconds)
- timeout: how long to wait until a lock can be established (seconds)
- keepAlie: boolean defining if the client should keep alive the lock in order to not run into the ttl

Returns an instance of the Lock class.

```javascript
const lock = client.createLock('cluster::67262', {
    timeout: 60,
    ttl: 10,
    keepAlive: false,
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


### LockClient.adoptLock

Adopt a already created lock, lets you cancel or free it. Be aware that this 
method doesn't validate the status or existence of the lock, so you may run 
into interesting problems. The client just assumes that the lock has the status 
acquired. 

ATTENTION: the original lock needs to have the keepAlive option disabled!

Needs a lock id to lock and takes optionally some options:

- ttl: defines how long the lock persists if the lock client stops refreshing the locks (seconds)
- timeout: how long to wait until a lock can be established (seconds)
- keepAlie: boolean defining if the client should keep alive the lock in order to not run into the ttl

Returns an instance of the Lock class.

```javascript
const lock = client.adoptLock(634265, {
    timeout: 60,
    ttl: 10,
    keepAlive: false,
});
```


### Lock.getId()

Returns the id of a acquired lock.

```javascript
const lockId = lock.getId();
```


### Lock.isAcquired()

Tessl you if the lock wa acquired. Does not indicate if it was freed already.

```javascript
const lockId = lock.isAcquired();
```