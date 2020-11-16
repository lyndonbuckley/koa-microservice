import {Microservice} from "./Microservice";
import {MicroserviceFeedbackType} from "../enum";
import {MicroserviceFeedbackArguments, MicroserviceFeedbackCallback} from "../types";

export class MicroserviceFeedbackHandler {
    app: Microservice;
    type: MicroserviceFeedbackType;
    callbacks: MicroserviceFeedbackCallback[] = [];

    constructor(
        app: Microservice,
        type: MicroserviceFeedbackType,
        callbacks?: MicroserviceFeedbackCallback[] | MicroserviceFeedbackCallback,
    ) {
        this.app = app;
        this.type = type;
        if (callbacks && typeof callbacks === "function") this.callbacks = [callbacks];
        else if (callbacks && Array.isArray(callbacks)) this.callbacks = callbacks;
    }

    addSubscriber(callback: MicroserviceFeedbackCallback) {
        this.callbacks.push(callback);
    }

    feedback(args: MicroserviceFeedbackArguments): void {
        let callback: MicroserviceFeedbackCallback;
        for (callback of this.callbacks)
            callback.apply(this, args)
    }
}
