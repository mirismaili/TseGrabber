import http from 'http'
import ipaddr from 'ipaddr.js'
import os from 'os'

/**
 * Created on 1399/7/12 (2020/10/3).
 * @author {@link https://mirismaili.github.io S. Mahdi Mir-Ismaili}
 */

export function fatalError(data) {
	console.error(data)
	process.exit(1)
}

export async function addExternalIpToTheInterfaceObject(theInterface) {
	return new Promise(resolve => {
		http.get({
			hostname: 'icanhazip.com',
			timeout: 1000,
			localAddress: theInterface.address,
			family: theInterface.family.slice('IPv'.length),  // 'IPv#' => '#'
		}, res => {
			console.log(res.statusCode, res.statusMessage)
			
			if (res.statusCode !== 200) {
						console.error('UNEXPECTED STATUS CODE:', res.statusCode, res.statusMessage, theInterface.address)
						return resolve(theInterface)
					}
					
					let externalAddress = null
					
					res.on('data', chunk => {
						externalAddress = chunk.toString().trim()
					})
					
					res.on('end', () => {
						if (ipaddr.isValid(externalAddress))
							return resolve({
								...theInterface,
								externalAddress,
							})
						
						console.error('UNEXPECTED RESPONSE:')  // Don't combine these two error-logs into one command. Here,
						console.error(externalAddress)			// we aren't sure if the above `chunk` has UTF-8 encoding or
						// not.
						resolve(theInterface)
					})
				}).on('error', err => {
					switch (err.code) {
							// Known errors:
						case 'EINVAL':        // { errno: -4071, code: 'EINVAL', syscall: 'bind' }
						case 'EADDRNOTAVAIL': // { errno: -99, code: 'EADDRNOTAVAIL', syscall: 'bind' }
						case 'ENETUNREACH':   // { errno: -4062, code: 'ENETUNREACH', syscall: 'connect' }
						case 'ENOENT':        // { errno: -4058, code: 'ENOENT', syscall: 'getaddrinfo' }
							break
						
						default:
							console.error(err, theInterface.address)
					}
					
					return resolve(theInterface)
				}).on('timeout', () => resolve(theInterface))
			},
	)
}

export async function getUsableExternalInterfaces(hostname) {
	let networkInterfaces = os.networkInterfaces()
	
	// flatten network interfaces object (insert all into a 1d array):
	
	// noinspection JSCheckFunctionSignatures
	const networkInterfacesP = Object.values(networkInterfaces).reduce((promises, deviceInterfaces) =>
			promises.concat(
					deviceInterfaces.map(addExternalIpToTheInterfaceObject),
			), [])
	
	networkInterfaces = await Promise.all(networkInterfacesP)
	
	const externalInterfaces = networkInterfaces.filter(({externalAddress}) => externalAddress)
	
	const usableExternalInterfacesP = externalInterfaces.map(async theInterface =>
			new Promise(resolve => {
				const req = http.request({
					hostname,
					method: 'HEAD',
					timeout: 10000,
					localAddress: theInterface.address,
					family: theInterface.family.slice('IPv'.length),  // 'IPv#' => '#'
				})
				req.on('error', err => {
					console.log(`OOPS! The interface "${theInterface.address}" can't be used, due to below error:`)
					console.log(err)    // `log()` is enough here.
					resolve(null)
				}).on('response', _ => {
					//console.log(_.statusCode, _.statusMessage, theInterface.address)
					resolve(theInterface)
					req.abort()  // Maybe the server doesn't support 'HEAD' method.
				}).on('timeout', () => {
					console.error(`OOPS! The interface "${theInterface.address}" can't be used, due to TIMEOUT error.`)
					resolve(null)
				}).end()
			}))
	
	return (await Promise.all(usableExternalInterfacesP)).filter(theInterface => theInterface)
}
