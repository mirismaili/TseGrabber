const os = require('os')
const http = require('http')
const zlib = require('zlib')
const {pipeline} = require('stream')
const fs = require('fs')
const {promisify} = require('util')
const pipe = promisify(pipeline)
const {workerData} = require('worker_threads')
const ipaddr = require('ipaddr.js')
const {
	Sequelize, DataTypes: {STRING, INTEGER, BIGINT, REAL, SMALLINT, TEXT},
} = require('sequelize')

/**
 * Created on 1399/7/18 (2020/10/9).
 * @author {@link https://mirismaili.github.io S. Mahdi Mir-Ismaili}
 */

const decompressMethod = {
	br: zlib.createBrotliDecompress.bind(zlib),
	// Or, just use `zlib.createUnzip` to handle both of the following cases:
	gzip: zlib.createGunzip.bind(zlib),
	deflate: zlib.createInflate.bind(zlib),
	compress: () => {
		console.error('NOT SUPPORTED CONTENT-ENCODING: "compress"')
		process.exit(1)
	},
}
//*********************************************************************************************************************/

const majorShareholdersSchema = {
	z0: INTEGER,
	coIsin12: STRING,
	stocks: BIGINT,
	percent: REAL,
	changeDirection: STRING,
	shareholderName: STRING,
	insCode: BIGINT,
	date: INTEGER,
}

const infoGroups = {
	BasicData: {
		searchPhrase: '<script>var InstSimpleData=',
		regex: /<script>var InstSimpleData=(\[.*?]);/,
		regex3: /^\[(?:'[-\p{L} \d\u200C]+?',){4}\d,'\w\d',(?:'IR\w{10}',){2}\d+?,\d+?\]$/u,
		schema: {
			name: STRING,
			symbol: STRING,
			market1: STRING,
			subMarket: STRING,
			marketCode: INTEGER,
			x7: STRING,
			coIsin12: STRING,
			isin12: STRING,
			totalStocks: BIGINT,
			baseBol: BIGINT,
			insCode: BIGINT,
			date: INTEGER,
		},
		uniques: ['insCode', 'date'],
	},
	PriceThresholds: {
		searchPhrase: '<script>var StaticTreshholdData=[',
		regex: /<script>var StaticTreshholdData=(\[.*?]);/,
		regex3: /^\[(?:'[-\p{L} \d\u200C]+?',){4}\d,'\w\d',(?:'IR\w{10}',){2}\d+?,\d+?\]$/u,
		schema: {
			dayTime: INTEGER,
			upperBound: INTEGER,
			lowerBound: INTEGER,
			insCode: BIGINT,
			date: INTEGER,
		},
		uniques: ['insCode', 'date', 'dayTime'],
	},
	Prices: {
		searchPhrase: '\r\nvar ClosingPriceData=[',
		regex: /^var ClosingPriceData=(\[.*?]);/m,
		regex3: /^\[(?:\['\d{4}(?:\/\d{1,2}){2} \d\d:\d\d:\d\d','[-\w]*?'(?:,'\d+?'){11}],?)+?]$/,
		schema: {
			dateTime: STRING,
			x1: STRING,
			latest: INTEGER,
			final: INTEGER,
			first: INTEGER,
			yesterday: INTEGER,
			highest: INTEGER,
			lowest: INTEGER,
			tradesCount: INTEGER,
			tradesVolume: BIGINT,
			tradesValue: BIGINT,
			x2: STRING,
			dayTime: INTEGER,
			insCode: BIGINT,
			date: INTEGER,
		},
		uniques: ['insCode', 'date', 'dayTime', 'tradesCount'],  // Actually 'dayTime' isn't needed. Just added for
																					// indexing.
	},
	// IntraDayPrices: {regex: /^var IntraDayPriceData=(\[\[.+?]]);/m, schema: },
	State: {
		searchPhrase: '\r\nvar InstrumentStateData=[',
		regex: /^var InstrumentStateData=(\[.*?]);/m,
		regex3: /^\[(?:\[\d{8},\d+,'\w[\w\s]'],?)+?]$/,
		schema: {
			fromDate: INTEGER,
			dayTime: INTEGER,
			state: STRING,
			insCode: BIGINT,
			date: INTEGER,
		},
		uniques: ['insCode', 'date', 'fromDate', 'dayTime'],
	},
	Trades: {
		searchPhrase: '\r\nvar IntraTradeData=[',
		regex: /^var IntraTradeData=(\[.*?]);/m,
		regex3: /^\[(?:\['\d+','\d\d:\d\d:\d\d'(?:,'\d+?'){2},\d+?],?)+?]$/,
		schema: {
			sequence: INTEGER,
			dayTime: STRING,
			volume: INTEGER,
			price: INTEGER,
			y: INTEGER,
			insCode: BIGINT,
			date: INTEGER,
		},
		uniques: ['insCode', 'date', 'dayTime', 'sequence'],  // Actually 'dayTime' isn't needed. Just added for indexing.
	},
	MajorShareholders: {
		searchPhrase: '\r\nvar ShareHolderData=[',
		regex: /^var ShareHolderData=(\[.*?]);/m,
		regex3: /^\[(?:\[\d+,'IR\w{10}',\d+,\d+?(?:\.\d+?)?,'(:?ArrowUp|ArrowDown|)','[-\p{L} .\u{200C}]+?'\],?)+?\]$/u,
		schema: majorShareholdersSchema,
		uniques: ['insCode', 'date', 'z0'],
	},
	MajorShareholdersYesterday: {
		searchPhrase: '\r\nvar ShareHolderDataYesterday=[',
		regex: /^var ShareHolderDataYesterday=(\[.*?]);/m,
		regex3: /^\[(?:\[\d+,'IR\w{10}',\d+,\d+?(?:\.\d+?)?,'(:?ArrowUp|ArrowDown|)','[-\p{L} .\u{200C}]+?'\],?)+?\]$/u,
		schema: majorShareholdersSchema,
		uniques: ['insCode', 'date', 'z0'],
	},
	BuyerSellerInfo: {
		searchPhrase: '\r\nvar ClientTypeData=',
		regex: /^var ClientTypeData=(\[.*?]);/m,
		regex3: /^\[(?:\d+?,){16}(?:\d+?(?:\.\d+?)?,){4}-?\d+?]$/,
		schema: {
			buyRealCount: INTEGER,
			buyLegalCount: INTEGER,
			sellRealCount: INTEGER,
			sellLegalCount: INTEGER,
			buyRealVolume: BIGINT,
			buyLegalVolume: BIGINT,
			sellRealVolume: BIGINT,
			sellLegalVolume: BIGINT,
			buyRealPercent: REAL,
			buyLegalPercent: REAL,
			sellRealPercent: REAL,
			sellLegalPercent: REAL,
			buyRealValue: BIGINT,
			buyLegalValue: BIGINT,
			sellRealValue: BIGINT,
			sellLegalValue: BIGINT,
			buyRealMeanPrice: REAL,
			buyLegalMeanPrice: REAL,
			sellRealMeanPrice: REAL,
			sellLegalMeanPrice: REAL,
			ownershipTransferToReal: BIGINT,
			insCode: BIGINT,
			date: INTEGER,
		},
		uniques: ['insCode', 'date'],
	},
	Orders: {
		searchPhrase: '<script>var BestLimitData=[',
		regex: /(\[.*?]);/,
		regex3: /^\[(?:\[\d{5,6},'[1-5]','\d{1,4}'(?:,'\d+?'){4},'\d{1,4}'],?)+?]$/,
		schema: {
			dayTime: INTEGER,
			line: SMALLINT,
			bidCount: SMALLINT,
			bidVolume: BIGINT,
			bidPrice: INTEGER,
			askPrice: INTEGER,
			askVolume: BIGINT,
			askCount: SMALLINT,
			insCode: BIGINT,
			date: INTEGER,
		},
		// Unfortunately there isn't any deterministic unique sequence logically, so we need to add all fields:
		uniques: [
			'insCode', 'date', 'dayTime',
			'line', 'bidPrice', 'askPrice', 'bidVolume', 'askVolume', 'bidCount', 'askCount',
		],
	},
}
//*********************************************************************************************************************/

const {externalInterface} = workerData
const localAddress = externalInterface.address
const family = externalInterface.family.slice('IPv'.length)  // 'IPv#' => '#'
//*********************************************************************************************************************/

const sequelize = new Sequelize(process.env.DB_URI || 'postgres://postgres@localhost/tse2', {
	logging: false,
	define: {timestamps: false},
})
const dbAuthentication = sequelize.authenticate()

const {} = initDbModels()
//*********************************************************************************************************************/

dbAuthentication.then(async () => {
	// await sequelize.sync({alter: true, logging: console.log})
	// await sequelize.sync({logging: console.log})
	await sequelize.sync({force: true, logging: console.log})
	
	const [freshFetchHistoryTasks] = await requestNewFetchHistoryTasks(10)
	
	for (const fetchHistoryTask of freshFetchHistoryTasks) {
		const {insCode, symbol, date} = fetchHistoryTask
		
		new Promise(resolve => {
					const req = http.get(`http://cdn.tsetmc.com/Loader.aspx?ParTree=15131P&i=${insCode}&d=${date}`, {
						timeout: 10000,
						localAddress,
						family,
					})
					
					req.on('error', err => {
						console.error(`ERROR FETCHING HTML (${theInterface.address}):`)
						console.error(err)
						resolve(null)
					})
					
					req.on('response', res => {
						const contentEncoding = res.headers['content-encoding']
						console.log(res.statusCode, res.statusMessage, theInterface.address, contentEncoding,
								res.headers['content-length'])
						
						let ioStream
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
						
						const groups = Object.keys(infoGroups)
						
						let i = -1, n = 0, size = 0, a, b
						let html = '', remindedChunk = '', textData = '', infoGroup = groups[n], dump = {}
						let phrase = infoGroups[infoGroup].searchPhrase
						let is2dArray = phrase.slice(-1) === '['
						let l = phrase.length - 1
						dump[infoGroup] = ''
						
						// data-loop:
						ioStream.on('data', chunk => {
							a = 0
							b = -1
							
							html += chunk
							i++
							console.log('======================================================================')
							console.log({i})
							console.log('length:', chunk.length)
							size += chunk.length
							
							// inner-loop
							while (true) {
								console.log('---------------------------------')
								if (!textData) {
									let index
									if (remindedChunk && (index = (remindedChunk + chunk.slice(0, l)).indexOf(phrase)) !== -1) {
										a = index + 1  // (-l + index + l + 1)
										console.log({a, index})
										remindedChunk = ''
									} else {
										const index = chunk.indexOf(phrase, b + 1)
										
										if (index === -1) {
											console.log({b})
											remindedChunk = chunk.slice(-l)
											return  // continue ...
										}
										
										a = index + phrase.length
										console.log({a})
									}
								}
								
								// noinspection PointlessBooleanExpressionJS
								do {
									if (is2dArray) {
										if (!textData && chunk[0] === ']') {
											console.log('OO', textData)
											break
										}
										
										b = chunk.indexOf(']]', a)
										
										if (b === -1) {
											b = chunk.lastIndexOf(']')
											
											if (b < a) {
												textData += chunk.slice(a)
												console.log('P2', textData)
												return  // continue data-loop ...
											}
											
											textData += chunk.slice(a, b + 1).replace(/[[\]]/g, match => match === '[' ? '(' : ')')
											dump[infoGroup] += dump[infoGroup] ? ',' + chunk.slice(a, b + 1) : chunk.slice(a, b + 1)
											console.log('P2', textData)
											// TODO: store textData
											textData = chunk.slice(b + 2)    // exclude ',' (before next '[')
											return  // continue data-loop ...
										}
										
										textData += chunk.slice(a, b + 1)
										if (textData) dump[infoGroup] += dump[infoGroup] ? ',' + textData : textData
										console.log('D2', textData)
										// TODO: store textData
										
										break  // initiate next inner-loop
									}
									
									b = chunk.indexOf(']', a)
									
									if (b === -1) {
										textData += chunk.slice(a)
										console.log('P1', textData)
										return  // continue data-loop ...
									}
									
									textData += chunk.slice(a, b + 1).replace(/[[\]]/g, match => match === '[' ? '(' : ')')
									if (textData) dump[infoGroup] += dump[infoGroup] ? ',' + textData : textData
									console.log('D1', textData)
									// TODO: store textData
								} while (false)  // 2d-arrays-loop
								
								// initiate next inner-loop:
								
								infoGroup = groups[++n]
								if (!infoGroup) {  // finished!
									req.abort()
									console.log('ABORT', {size})
									fs.writeFileSync('temp2.html', html)
									return resolve({html, dump})
								}
								dump[infoGroup] = ''
								phrase = infoGroups[infoGroup].searchPhrase
								console.log('********************************************************************************')
								console.log({group: infoGroup, phrase})
								is2dArray = phrase.slice(-1) === '['
								l = phrase.length - 1
								
								// reset parameters:
								textData = ''
							}
						})
						
						ioStream.on('END', () => {
							console.log('end', {size})
							fs.writeFileSync('temp2.html', html)
							resolve()
						})
						
						ioStream.on('error', err => {
							console.error.bind(console, 'DECOMPRESS ERROR:')
							res.on('data', console.log)
						})
					})
					
					req.on('timeout', () => {
						console.error(`TIMEOUT (${theInterface.address})!`)
						resolve(null)
					})
					
					req.end()
				},
		)
	}
	
	console.log(freshFetchHistoryTasks)
}).catch(e => {
	console.error(e)
	process.exitCode = -1
}).finally(() => {
	console[process.exitCode ? 'error' : 'log']('FINISHED')
	process.exit()
})

async function requestNewFetchHistoryTasks(n) {
	return await sequelize.query(`
			UPDATE "FetchHistoriesProject"
			SET "lastTry" = now()
			WHERE ("insCode", date) IN (
				SELECT "insCode", date
				FROM "FetchHistoriesProject"
				WHERE done = FALSE
				 AND (now() - "lastTry" > '10 minutes')
				ORDER BY "lastTry" DESC, symbol, date
				LIMIT ${n} FOR UPDATE
			)
			RETURNING "insCode", symbol, date
		`)
}

function initDbModels() {
	const FetchHistoriesProject = sequelize.define('FetchHistoriesProject', disallowNullAll({
		insCode: {
			type: BIGINT,
			primaryKey: true,
		},
		symbol: STRING,
		date: {
			type: INTEGER,
			primaryKey: true,
		},
		lastTry: 'TIMESTAMPTZ',
		done: BOOLEAN,
	}, {
		freezeTableName: true,
		indexes: [{
			fields: [
				'done',
				{
					attribute: 'lastTry',
					order: 'DESC',
				},
				'symbol',
				'date',
			],
		}],
	}))
	FetchHistoriesProject.removeAttribute('id')
	
	return {FetchHistoriesProject}
}

function disallowNullAll(schema) {
	for (const col in schema) {
		if (schema[col].type)
			schema[col].allowNull = false
		else
			schema[col] = {
				type: schema[col],
				allowNull: false,
			}
	}
	return schema
}

function fatalError(data) {
	console.error(data)
	process.exit(1)
}
