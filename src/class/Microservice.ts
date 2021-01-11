import Koa, {DefaultContext, DefaultState} from "koa";
import {MicroserviceOptions} from "../interfaces";
import {MicroserviceEventHandler} from "./MicroserviceEventHandler";
import {MicroserviceEventType, MicroserviceFeedbackType, MicroserviceListenerStatus, MicroserviceStatus} from "../enum";
import {MicroserviceFeedbackHandler} from "./MicroserviceFeedbackHandler";
import {
    MicroserviceEventCallback,
    MicroserviceFeedbackArguments,
    MicroserviceFeedbackCallback,
    MicroserviceHealthCheckCallback, MicroserviceListener
} from "../types";
import {MicroserviceHTTPListener} from "../listen/MicroserviceHTTPListener";
import {existsSync} from "fs";
import {resolve} from "path";
import {hostname} from "os";

const packageJSON = (():any|null => {
    const currentDir = resolve('.','package.json');
    if (existsSync(currentDir)) {
        return require(currentDir);
    }
    const parentDir = resolve('..','package.json');
    if (existsSync(parentDir)) {
        return require(parentDir);
    }
    return {}
})();

export class Microservice<C extends DefaultContext, S extends DefaultState> extends Koa<DefaultContext, DefaultState> {
    constructor(opts?: MicroserviceOptions) {
        super();

        // events
        this._onStartup = new MicroserviceEventHandler(this, MicroserviceEventType.Startup, opts?.startupCallbackMode, opts?.onStartup);
        this._onShutdown = new MicroserviceEventHandler(this, MicroserviceEventType.Shutdown, opts?.shutdownCallbackMode, opts?.onShutdown);
        this._onListening = new MicroserviceEventHandler(this, MicroserviceEventType.Listening, opts?.listeningCallbackMode, opts?.onListening);

        // feedback
        this._onLog = new MicroserviceFeedbackHandler(this, MicroserviceFeedbackType.Log);
        this._onInfo = new MicroserviceFeedbackHandler(this, MicroserviceFeedbackType.Info);
        this._onWarn = new MicroserviceFeedbackHandler(this, MicroserviceFeedbackType.Warn);
        this._onError = new MicroserviceFeedbackHandler(this, MicroserviceFeedbackType.Error);

        // add default health check
        this.addHealthCheck(this._defaultHealthCheck.bind(this));

        // name and banner
        this.name = opts?.name || packageJSON?.name || 'Microservice';
        this.version = opts?.version || packageJSON?.version || '0.0.0';
        this.banner = opts?.banner || `${this.name}/${this.version}`;

        // options
        if (opts?.useConsole) this.useConsole();
        if (opts?.healthCheckUserAgent) this.healthCheckUserAgent = opts.healthCheckUserAgent;
        if (opts?.healthCheckEndpoint) this.healthCheckEndpoint = opts.healthCheckEndpoint;
        if (opts?.shutdownTimeout) this._shutdownTimeout = opts.shutdownTimeout;
        if (opts?.sendReadyOnceListening) this.sendReadyOnceListening();

        // initialising status
        this._status = this.changeStatus(MicroserviceStatus.Initialising);

        // listen to process events
        process.on('SIGTERM', this._handleSIGTERM.bind(this));
        process.on('SIGINT', this._handleSIGINT.bind(this));
        process.on('message', this._handleMessage.bind(this));

        this.use(this.HealthCheckMiddleware.bind(this));
        this.use(this.RequestMiddleware.bind(this));
    }

    // PROXY - by default use proxy headers
    proxy: boolean = true;



    // --------------
    //     STATUS
    // --------------

    private _status: MicroserviceStatus;
    get status(): MicroserviceStatus {
        return this._status;
    }
    private changeStatus(status: MicroserviceStatus) {
        this._status = status;
        switch (status) {
            case MicroserviceStatus.ShuttingDown:
                this.warn(this.getBanner(status));
                break;
            default:
                this.info(this.getBanner(status));
        }
        return status;
    }

    // --------------
    //     BANNER
    // --------------

    name?: string;
    version?: string;
    banner?: string;
    getBanner(suffix?: string) {
        if (suffix) return `${this.banner} ${suffix}`;
        return this.banner;
    }

    // --------------------
    //     HEALTH CHECK
    // --------------------

    private _healthCheckEndpoint: string[] = [];
    get healthCheckEndpoint(): string | string[] {
        return this._healthCheckEndpoint;
    }
    set healthCheckEndpoint(endpoint: string | string[]) {
        if (typeof endpoint === 'string') endpoint = [endpoint];
        this._healthCheckEndpoint = endpoint;
    }

    private _healthCheckUserAgent: string[] = [
        'GoogleHC/1.0',
        'Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)',
        'NS1 HTTP Monitoring Job',
        'ELB-HealthChecker/2.0',
    ];
    get healthCheckUserAgent(): string | string[] {
        return this._healthCheckUserAgent;
    }
    set healthCheckUserAgent(userAgent: string | string[]) {
        if (typeof userAgent === 'string') userAgent = [userAgent];
        this._healthCheckUserAgent = userAgent;
    }

    private async _handleHealthCheck(ctx: Koa.Context) {
        const healthy: boolean = await this._performHealthChecks(ctx);
        ctx.status = healthy ? 200 : 503;
        ctx.body = {
            healthy,
            status: this.status,
            service: {
                name: this.name,
                version: this.version,
                banner: this.banner,
            },
            instance: {
                host: hostname(),
                pid: process.pid,
                ppid: process.ppid,
                uptime: process.uptime(),
            },
        };
    }

    private _healthChecks: MicroserviceHealthCheckCallback[] = [];

    private async _performHealthChecks(ctx: Koa.Context) {
        let callback: MicroserviceHealthCheckCallback;
        for (callback of this._healthChecks) {
            let result: Promise<boolean> | boolean = callback(ctx);
            if (result instanceof Promise) result = await result;
            if (result !== true) return false;
        }
        return true;
    }

    private _defaultHealthCheck(ctx: Koa.Context) {
        return this.status === MicroserviceStatus.Listening ? true : false;
    }

    addHealthCheck(callback: MicroserviceHealthCheckCallback) {
        this._healthChecks.push(callback);
    }

    // ------------------
    //     MIDDLEWARE
    // ------------------

    private async HealthCheckMiddleware(ctx: Koa.Context, next: Koa.Next) {
        const userAgent = ctx.request.headers['user-agent'] || '';
        if (this._healthCheckUserAgent.indexOf(userAgent) >= 0) return await this._handleHealthCheck(ctx);
        if (this._healthCheckEndpoint.indexOf(ctx.path) >= 0) return await this._handleHealthCheck(ctx);
        return await next();
    }

    private async RequestMiddleware(ctx: Koa.Context, next: Koa.Next) {
        ctx._requestStarted = new Date();

        // set server banner
        if (this.banner)
            ctx.set('Server', this.banner);

        // close connection if shutting down
        if (this.status === MicroserviceStatus.ShuttingDown)
            ctx.set('Connection', 'close');

        // 503 if not ready
        if (!this.isReady)
            return (ctx.status = 503);

        // handle request
        await next();

        ctx._requestFinished = new Date();
    }

    // -------------
    //    EVENTS
    // -------------

    private _onStartup: MicroserviceEventHandler;
    onStartup(func: MicroserviceEventCallback) {
        this._onStartup.addSubscriber(func);
    }

    private _onShutdown: MicroserviceEventHandler;
    onShutdown(func: MicroserviceEventCallback) {
        this._onShutdown.addSubscriber(func);
    }

    private _onListening: MicroserviceEventHandler;
    onListening(func: MicroserviceEventCallback) {
        this._onListening.addSubscriber(func);
    }

    // ---------------
    //    FEEDBACK
    // ---------------

    private _onLog: MicroserviceFeedbackHandler;
    onLog(func: MicroserviceFeedbackCallback) {
        this._onLog.addSubscriber(func);
    }
    log(...args: MicroserviceFeedbackArguments) {
        return this._onLog.feedback(args);
    }

    private _onInfo: MicroserviceFeedbackHandler;
    onInfo(func: MicroserviceFeedbackCallback) {
        this._onInfo.addSubscriber(func);
    }
    info(...args: MicroserviceFeedbackArguments) {
        return this._onInfo.feedback(args);
    }

    private _onWarn: MicroserviceFeedbackHandler;
    onWarn(func: MicroserviceFeedbackCallback) {
        this._onWarn.addSubscriber(func);
    }
    warn(...args: MicroserviceFeedbackArguments) {
        return this._onWarn.feedback(args);
    }
    private _onError: MicroserviceFeedbackHandler;
    onError(func: MicroserviceFeedbackCallback) {
        this._onError.addSubscriber(func);
    }
    error(...args: MicroserviceFeedbackArguments) {
        return this._onError.feedback(args);
    }

    // ---------------
    //     CONSOLE
    // ---------------

    private _useConsole: boolean = false;
    useConsole() {
        this._useConsole = true;
        this.onLog(console.log)
        this.onInfo( console.info);
        this.onWarn(console.warn);
        this.onError(console.error);
    }

    // ---------------
    //     STARTUP
    // ---------------

    private async processStartup(): Promise<boolean> {
        return this._onStartup.process();
    }
    private async _start() {
        switch (this._status) {
            case MicroserviceStatus.Initialising:
                this.changeStatus(MicroserviceStatus.Starting);

                if (await this.processStartup())
                    this.changeStatus(MicroserviceStatus.Ready);
                else this.error('Startup Callbacks did not all return true');

                if (this.status === MicroserviceStatus.Ready) await this.startListeners();

                if (this.getActiveListeners().length > 0) {
                    this.changeStatus(MicroserviceStatus.Listening);
                    await this._onListening.process();
                }
                break;
            case MicroserviceStatus.Starting:
                throw new Error('Called Start function when already starting');
                return;
            case MicroserviceStatus.Ready:
            case MicroserviceStatus.Listening:
                throw new Error('Called Start function when already starting');
                return;
            case MicroserviceStatus.ShuttingDown:
                throw new Error('Called Start function when shutting down');
                return;
        }
    }
    start() {
        this._start().catch(this.error);
    }
    get isReady(): boolean {
        if (this.status === MicroserviceStatus.Listening) return true;
        if (this.status === MicroserviceStatus.Ready) return true;
        return false;
    }

    // ------------
    //

    private _listeners: MicroserviceListener[] = [];
    http(port?: number, host?: string, domain?: string): MicroserviceHTTPListener {
        if (!port) port = Number(process.env.PORT) || 8080;
        if (!host) host = '0.0.0.0';
        const listener = new MicroserviceHTTPListener(this, host, port, domain);
        this._listeners.push(listener);
        return listener;
    }

    getActiveListeners() {
        const active: MicroserviceListener[] = [];
        let listener: MicroserviceListener;
        for (listener of this._listeners)
            if (listener.status === MicroserviceListenerStatus.Started)
                active.push(listener);

        return active;
    }

    private async startListeners() {
        let listener: MicroserviceListener;
        for (listener of this._listeners) await listener.start()
    }

    private _sendReadyOnceListening: boolean = false;
    sendReadyOnceListening() {
        if (this._sendReadyOnceListening) return;
        this._sendReadyOnceListening = true;
        this.onListening(() => {
            if (process && process.send) process.send('ready');
        });
    }

    // -----------------
    //     SHUTDOWN
    // -----------------

    private _shutdownTimeout: number = 15000;
    private _handleSIGTERM() {
        return this.shutdown('SIGTERM');
    }
    private _handleSIGINT() {
        return this.shutdown('SIGINT');
    }
    private _handleMessage(message: any) {
        if (message === 'shutdown') this.shutdown('Received shutdown message');
    }

    shutdown(warning?: string) {
        // exit if already shutting down
        if (this.status === MicroserviceStatus.ShuttingDown) return;

        // warning message
        if (warning) this.warn(warning);

        // change state to shutting down
        this.changeStatus(MicroserviceStatus.ShuttingDown);

        // create shutdown timeout
        const timeout = setTimeout(() => {
            this.error('Shutdown timeout reached');
            process.exit(-1);
        }, this._shutdownTimeout);

        // attempt shutdown
        this._onShutdown
            .process()
            .then((result: boolean) => {
                if (result) process.exit(0);
                else if (result) process.exit(-1);
            })
            .catch((err) => {
                console.error(err);
                process.exit(-1);
            });
    }


}
