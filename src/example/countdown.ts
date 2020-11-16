import {Microservice} from "../class/Microservice";
import { Context, Next } from 'koa';

const app = new Microservice({
    banner: 'Countdown/1.0.0',
    useConsole: true,
    onStartup: async () => {
        return await demoCountdown('Starting');
    },
    onShutdown: async () => {
        return await demoCountdown('Shutting Down');
    },
    onListening: () => {
        console.log('On Listening Has Been Called');
    },
});

app.use(async (ctx: Context, next: Next) => {
    ctx.body = 'Hello World';
});

app.healthCheckEndpoint = '/healthy';
app.addHealthCheck((ctx: Context) => {
    console.log('Health Check on ' + ctx.url);
    return true;
});

app.http(8080);
app.start();

async function demoCountdown(label: string, limit: number = 3): Promise<boolean> {
    return await new Promise((resolve, reject) => {
        let count: number = 0;
        function step() {
            if (count >= limit) return resolve(true);
            else setTimeout(step, 1000);
            console.info(label + ' in ' + (limit - count));
            count++;
        }
        step();
    });
}
