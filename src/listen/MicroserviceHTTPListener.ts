import {Microservice} from "../class/Microservice";
import {MicroserviceListenerStatus, MicroserviceListenerType} from "../enum";
import {MicroserviceListenerStart, MicroserviceListenerStop} from "../func/MicroserviceListenerFunctions";
import {createServer, Server} from "http";
import {DefaultContext, DefaultState} from "koa";

export class MicroserviceHTTPListener {

    app: Microservice<DefaultContext, DefaultState>;
    type?: MicroserviceListenerType;
    status: MicroserviceListenerStatus;
    start: ()=>Promise<boolean>;
    stop: ()=>Promise<boolean>;

    host: string;
    port: number;
    domain?: string;
    url?: string;

    server: Server;

    constructor(app: Microservice<DefaultContext, DefaultState>, host: string, port: number, domain?: string) {
        this.app = app;
        this.host = host;
        this.port = port;
        this.domain = domain;

        this.type = MicroserviceListenerType.HTTP;
        this.status = MicroserviceListenerStatus.Initialising;
        this.start = MicroserviceListenerStart.bind(this);
        this.stop = MicroserviceListenerStop.bind(this);

        this.server = createServer(app.callback());
    }

    getAddress():string {
        if (this.url) return this.url;

        let url = 'http://';
        url = url + (this.domain || this.host);
        if (this.port !== 80) url = url + ':' + this.port;

        return url + '/';
    }

    async _startListener(): Promise<boolean> {
        const { app, server } = this;
        return new Promise((resolve, reject) => {
            try {
                server.listen(this.port, this.host, () => {
                    resolve(true);
                });
            } catch (err) {
                app.error(err);
                resolve(false);
            }
        });
    }

    async _stopListener(): Promise<boolean> {
        const listener = this;
        return await new Promise((resolve, reject) => {
            listener.server.close((err) => {
                if (err) resolve(false);
                else resolve(true);
            });
        });
    }

}
