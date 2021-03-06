import {Context} from "koa";
import {MicroserviceEvent} from "./interfaces";
import {MicroserviceHTTPListener} from "./listen/MicroserviceHTTPListener";
export type MicroserviceEventCallback<T = MicroserviceEventArguments> = (event: MicroserviceEvent<T>) => Promise<boolean | void> | boolean | void;
export type MicroserviceHealthCheckCallback = (ctx: Context) => Promise<boolean> | boolean;
export type MicroserviceListener = MicroserviceHTTPListener;
export type MicroserviceEventArguments = [any?, ...any[]];
export type MicroserviceFeedbackArguments = [any?, ...any[]];

export type MicroserviceFeedbackCallback = (...args: MicroserviceFeedbackArguments) => any;
