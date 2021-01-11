import {MicroserviceEventArguments, MicroserviceEventCallback} from "./types";
import {
    MicroserviceEventCallbackMode,
    MicroserviceEventType,
    MicroserviceListenerStatus,
    MicroserviceListenerType
} from "./enum";
import {Microservice} from "./class/Microservice";
import {DefaultContext, DefaultState} from "koa";

export interface MicroserviceOptions {
    name?: string;
    version?: string;
    banner?: string;
    useConsole?: boolean;
    onStartup?: MicroserviceEventCallback[] | MicroserviceEventCallback;
    onShutdown?: MicroserviceEventCallback[] | MicroserviceEventCallback;
    onListening?: MicroserviceEventCallback[] | MicroserviceEventCallback;
    startupCallbackMode?: MicroserviceEventCallbackMode;
    shutdownCallbackMode?: MicroserviceEventCallbackMode;
    listeningCallbackMode?: MicroserviceEventCallbackMode;
    shutdownTimeout?: number;
    sendReadyOnceListening?: boolean;
    healthCheckEndpoint?: string | string[];
    healthCheckUserAgent?: string | string[];
}

export interface MicroserviceEvent<T = MicroserviceEventArguments> {
    type: MicroserviceEventType;
    time: Date;
    app: Microservice<DefaultContext, DefaultState>;
    args?: T;
}

export interface MicroserviceListenerInterface {
    app: Microservice<DefaultContext, DefaultState>;
    type?: MicroserviceListenerType;
    status: MicroserviceListenerStatus;

    shutdown: ()=>Promise<any>;
    listen: ()=>Promise<boolean>;
    close: ()=>Promise<boolean>;

    getAddress(): string;
    _startListener(): Promise<boolean>;
    _stopListener(): Promise<boolean>;
}
