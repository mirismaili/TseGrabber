const {
	Worker,
} = require('worker_threads')
const {getUsableExternalInterfaces} = require('utilities')

/**
 * Created on 1399/7/16 (2020/10/7).
 * @author {@link https://mirismaili.github.io S. Mahdi Mir-Ismaili}
 */

process.on('exit', code => console[process.exitCode ? 'error' : 'log']('FINISHED /', code))

getUsableExternalInterfaces('tsetmc.ir').then(usableExternalInterfaces =>
		Promise.all(usableExternalInterfaces.map(externalInterface =>
				new Promise((resolve, reject) => {
					// Start a new worker-thread:
					const worker = new Worker('./worker.js', {
						workerData: {externalInterface},
					})
					//worker.on('message', msg => console.log('MESSAGE FROM WORKER:', msg))
					worker.on('error', reject)
					worker.on('exit', code => {
						if (code !== 0)
							return reject(new Error(`Worker stopped with exit code ${code}`))
						resolve()
					})
				}),
		)),
).catch(e => {
	console.error(e)
	process.exitCode = -1
}).finally(process.exit)

