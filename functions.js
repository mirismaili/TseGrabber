import debug from 'debug'
import http from 'http'
import zlib from 'zlib'
import {StreamParser} from './StreamParser.js'
import {fatalError} from './utilities.js'

/**
 * Created on 1399/7/22 (2020/10/13).
 * @author {@link https://mirismaili.github.io S. Mahdi Mir-Ismaili}
 */

const generalLog = debug('stream-parser:GN')

const decompressMethod = {
	br: zlib.createBrotliDecompress.bind(zlib),
	// Or, just use `zlib.createUnzip` to handle both of the following cases:
	gzip: zlib.createGunzip.bind(zlib),
	deflate: zlib.createInflate.bind(zlib),
	compress: () => fatalError('NOT SUPPORTED CONTENT-ENCODING: "compress"'),
}

export const pipeFetchToDb = (insCode, date, {
	timeout = 30000,
	theInterface,
	exportResults = true,
} = {}) => new Promise((resolve, reject) => {
	const req = http.request(`http://cdn.tsetmc.com/Loader.aspx?ParTree=15131P&i=${insCode}&d=${date}`, {
		timeout,
		localAddress: theInterface?.address,
		family: theInterface?.family?.slice?.('IPv'.length),  // 'IPv#' => '#'
	})
	
	req.on('response', res => {
		let ioStream
		{
			const contentEncoding = res.headers['content-encoding']
			generalLog(res.statusCode, res.statusMessage, theInterface?.address, contentEncoding,
					res.headers['content-length'])
			
			if (!contentEncoding || contentEncoding === 'identity')
				ioStream = res
			else {
				const decompressStreamF = decompressMethod[contentEncoding]
				
				if (!decompressStreamF)
					fatalError('NOT SUPPORTED CONTENT-ENCODING:', contentEncoding)
				else {
					ioStream = decompressStreamF()
					res.pipe(ioStream)
				}
			}
			
			const charset = res.headers['content-type'].split('charset=')[1]
			
			if (!Buffer.isEncoding(charset))
				fatalError('NOT SUPPORTED CHARSET:', charset)
			
			ioStream.setEncoding(charset)
		}
		
		const streamParser = new StreamParser(req, resolve)
		
		// data-loop:
		ioStream.on('data', streamParser.parse.bind(streamParser))
		
		ioStream.on('END', () => {
			//console.log('end', {size})
			//fs.writeFileSync('temp.html', streamParser.html)
			resolve()
		})
		
		ioStream.on('error', err => {
			console.error.bind(console, 'DECOMPRESS ERROR:')
			res.on('data', console.log)
		})
	})
	
	req.on('error', reject)
	req.on('timeout', reject)
	
	req.end()
})
