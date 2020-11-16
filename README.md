# koa-microservice
Microservice Server for Koa

| ------ | ------------------------------------------------- |
| GitHub | https://github.com/lyndonbuckley/koa-microservice |
| NPM | https://www.npmjs.com/package/koa-microservice |
|-----| ----|

## Intro

This package is a starting point for
common functionality used when creating services and APIs using Koa Framework (https://github.com/koajs)

- Multiple Listeners
- Graceful Startup/Shutdown (with support for process messages)
- Built-in Health Check Endpoints/Middleware


## Example

```typescript
import {Microservice} from "koa-extended-server"
import {createConnection, Conection} from "typeorm";

const dbConnection: Connection;
const app = new Microservice();

// open database connection
app.onStartup(async()=>{
    dbConnection = await createConnection();
    return dbConnection.isConnected;
});

// close database connection
app.onShutdown(async() => {
    if (dbConnection.isConnected)
        await dbConnection.close();
    
    return (dbConnection.isConnected ? false : true)
});

// health check
app.addHealthCheck(() => {
    return dbConnection.isConnected;
});

// HTTP listener
app.http(8080);

// start
app.start();

```

## Graceful Startup/Shutdown

### onStartup

Perform operations or checks before starting server - Example use cases:

#### Connect to Database ORM
```typescript
const dbConnection: Connection;
async function connectToDatabase(): Promise<boolean> {
 dbConnection = await createConnection();
    return dbConnection.isConnected;
}

const app = new Microservice();
app.onStartup(connectToDatabase);
```

#### Subscribe to PubSub Topic

```typescript
import {PubSub} from '@google-cloud/pubsub';
const pubSubClient = new PubSub();
async function subscribe() {
    const sub = await pubSubClient.topic('TOPIC_NAME').createSubscription('UNIQUE_NAME');
    return sub ? true : false;
}

const app = new Microservice({
    onStartup: subscribe
})
```


## Health Checks

#### Specifying userAgent in options
```typescript 
const app = new Microservice({
    healthCheckEndpoint: '/health-check'
});
```
#### Specifying userAgent in options
```typescript 
const app = new Microservice({
    healthCheckUserAgent: 'GoogleHC/1.0'
});
```
#### Setting via parameter
```typescript 
const app = new Microservice();
app.healthCheckEndpoint = '/health-check';
app.healthCheckUserAgent = ['GoogleHC/1.0','NS1 HTTP Monitoring Job'];
```
