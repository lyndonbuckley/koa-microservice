export enum MicroserviceEventCallbackMode {
    Series = 'series',
    Parallel = 'parallel',
    Background = 'background',
}

export enum MicroserviceEventType {
    Startup = 'startup',
    Shutdown = 'shutdown',
    Listening = 'listening'
}

export enum MicroserviceFeedbackType {
    Log = 'log',
    Info = 'info',
    Warn = 'warn',
    Error = 'error',
}

export enum MicroserviceListenerType {
    HTTP = 'http',
}
export enum MicroserviceListenerStatus {
    Initialising = 'init',
    Started = 'started',
    Stopped = 'stopped',
    Error = 'error',
}

export enum MicroserviceStatus {
    Initialising = 'init',
    Starting = 'starting',
    Ready = 'ready',
    Listening = 'listening',
    ShuttingDown = 'shuttingDown',
}
