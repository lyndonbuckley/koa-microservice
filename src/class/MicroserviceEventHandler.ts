import {Microservice} from "./Microservice";
import {MicroserviceEventCallbackMode, MicroserviceEventType} from "../enum";
import {MicroserviceEventArguments, MicroserviceEventCallback} from "../types";
import {MicroserviceEvent} from "../interfaces";

export class MicroserviceEventHandler<T = MicroserviceEventArguments> {
    app: Microservice;
    type: MicroserviceEventType;
    callbacks: MicroserviceEventCallback<T>[] = [];
    mode: MicroserviceEventCallbackMode;

    constructor(
        app: Microservice,
        type: MicroserviceEventType,
        mode?: MicroserviceEventCallbackMode,
        callbacks?: MicroserviceEventCallback<T>[] | MicroserviceEventCallback<T>,
    ) {
        this.app = app;
        this.type = type;

        if (!mode && [MicroserviceEventType.Startup, MicroserviceEventType.Shutdown].indexOf(type) >= 0) mode = MicroserviceEventCallbackMode.Series;
        else if (!mode) mode = MicroserviceEventCallbackMode.Parallel;
        this.mode = mode;

        if (callbacks && Array.isArray(callbacks)) this.callbacks = callbacks;
        else if (callbacks) {
            this.callbacks = [callbacks];
        }
    }

    addSubscriber(callback: MicroserviceEventCallback<T>) {
        this.callbacks.push(callback);
    }

    async process(args?: T): Promise<boolean> {
        const event: MicroserviceEvent<T> = {
            type: this.type,
            time: new Date(),
            app: this.app,
            args,
        };

        const promises = [];
        let callback: MicroserviceEventCallback<T>;
        for (callback of this.callbacks) {
            const process = this.processCallback(event, callback);
            promises.push(process);
            if (this.mode === MicroserviceEventCallbackMode.Series) await process;
        }

        const results = await Promise.all(promises);
        let result: boolean = true;
        if (results.indexOf(false) >= 0) result = false;
        return result;
    }

    private async processCallback(event: MicroserviceEvent<T>, callback: MicroserviceEventCallback<T>): Promise<boolean> {
        try {
            // trigger callback
            const cb = callback.bind(event);
            const result = cb.apply(this.app, [event]);
            if (result instanceof Promise) await result;

            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    }
}
