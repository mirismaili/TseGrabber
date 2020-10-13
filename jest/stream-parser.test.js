import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'
import {pipeFetchToDb} from '../functions.js'
import {infoGroups} from '../schemas.js'

/**
 * Created on 1399/7/12 (2020/10/3).
 * @author {@link https://mirismaili.github.io S. Mahdi Mir-Ismaili}
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const randomDatasetTsv = fs.readFileSync(path.join(__dirname, 'random-dataset.tsv'), 'utf-8').trim()
const randomDataset = randomDatasetTsv.split('\n').map(row => {
	const fields = row.split('\t')
	return {
		symbol: fields[0],
		date: fields[1],
		insCode: fields[2],
	}
})

describe.each(randomDataset.slice(68, 69))('%s', ({insCode, date}) => {
	let offset = 0, dump2 = {}
	let dump, html
	
	beforeAll(async () => {
		const result = await pipeFetchToDb(insCode, date)
		html = result.html
		dump = result.dump
	}, 5000)
	
	test.each(Object.entries(infoGroups))('%s', async (infoGroup, {regex, schema}) => {
		const regMatch = regex.exec(html.slice(offset))
		
		offset += regMatch.index + regMatch[0].length
		
		dump2 = regMatch[1]
		
		if (dump2.startsWith('[[')) dump2 = dump2.slice(1, -1)
		
		expect(dump[infoGroup]).toEqual(dump2)
	})
})
