import {MicroserviceListenerStatus} from "../enum";
import {MicroserviceListener} from "../types";

export async function MicroserviceListenerStart(this: MicroserviceListener): Promise<boolean> {
    const start = await this._startListener();
    if (!start) {
        this.status = MicroserviceListenerStatus.Error;
        return false;
    }

    this.status = MicroserviceListenerStatus.Started;
    this.app.info(this.app.getBanner() + ' at ' + this.getAddress());
    return start;
}

export async function MicroserviceListenerStop(this: MicroserviceListener): Promise<boolean> {
    const stop = await this._stopListener();
    if (!stop) {
        this.status = MicroserviceListenerStatus.Error;
        return false;
    }
    this.status = MicroserviceListenerStatus.Stopped;
    return stop;
}
