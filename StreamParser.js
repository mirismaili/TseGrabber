import {infoGroups} from './schemas.js'

/**
 * Created on 1399/7/22 (2020/10/13).
 * @author {@link https://mirismaili.github.io S. Mahdi Mir-Ismaili}
 */

export class StreamParser {
	static groups = Object.keys(infoGroups)
	
	constructor(req, resolve) {
		Object.assign(this, {req, resolve})
		this.i = -1
		this.n = 0
		this.size = 0
		this.html = ''
		this.remindedChunk = ''
		this.textData = ''
		this.dump = {}
		this.infoGroup = StreamParser.groups[this.n]
		this.phrase = infoGroups[this.infoGroup].searchPhrase
		this.is2dArray = this.phrase.slice(-1) === '['
		this.l = this.phrase.length - 1
		this.dump[this.infoGroup] = ''
	}
	
	parse(chunk) {
		let a = 0
		let b = -1
		
		this.html += chunk
		this.i++
		//console.log('======================================================================')
		//console.log('i:', this.i)
		//console.log('length:', chunk.length)
		this.size += chunk.length
		
		// inner-loop
		while (true) {
			//console.log('---------------------------------')
			if (!this.textData) {
				let index
				if (this.remindedChunk &&
						(index = (this.remindedChunk + chunk.slice(0, this.l)).indexOf(this.phrase)) !== -1) {
					a = index + 1  // (-l + index + l + 1)
					//console.log({a, index})
					this.remindedChunk = ''
				} else {
					const index = chunk.indexOf(this.phrase, b + 1)
					
					if (index === -1) {
						//console.log({b})
						this.remindedChunk = chunk.slice(-this.l)
						return  // continue ...
					}
					
					a = index + this.phrase.length
					//console.log({a})
				}
			}
			
			// noinspection PointlessBooleanExpressionJS
			do {
				if (this.is2dArray) {
					if (!this.textData && chunk[0] === ']') {
						//console.log('OO', this.textData)
						break
					}
					
					b = chunk.indexOf(']]', a)
					
					if (b === -1) {
						b = chunk.lastIndexOf(']')
						
						if (b < a) {  // We should check if (b <= a). But we know b can't be equal to a
							this.textData += chunk.slice(a)
							//console.log('P2', this.textData)
							return  // continue data-loop ...
						}
						
						this.textData += chunk.slice(a, b + 1)//.replace(/[[\]]/g, match => match === '[' ?
																		  // '(' : ')')
						this.dump[this.infoGroup] += this.dump[this.infoGroup] ? ',' + this.textData : this.textData
						//console.log('P2', this.textData)
						// TODO: store textData
						this.textData = chunk.slice(b + 2)    // exclude ',' (before next '[')
						return  // continue data-loop ...
					}
					
					this.textData += chunk.slice(a, b + 1)
					this.dump[this.infoGroup] += this.dump[this.infoGroup] ? ',' + this.textData : this.textData
					//console.log('D2', this.textData)
					// TODO: store textData
					
					break  // initiate next inner-loop
				}
				
				b = chunk.indexOf(']', a)
				
				if (b === -1) {
					this.textData += chunk.slice(a)
					//console.log('P1', this.textData)
					return  // continue data-loop ...
				}
				
				this.textData += chunk.slice(a, b + 1)
				if (this.textData) this.dump[this.infoGroup] += this.dump[this.infoGroup] ? ',' + this.textData : this.textData
				//console.log('D1', this.textData)
				// TODO: store textData
			} while (false)  // 2d-arrays-loop
			
			// initiate next inner-loop:
			
			this.infoGroup = StreamParser.groups[++this.n]
			if (!this.infoGroup) {  // finished!
				this.req.abort()
				//console.log('ABORT', this)
				// fs.writeFileSync('temp.html', this.html)
				return this.resolve(this)
			}
			this.dump[this.infoGroup] = ''
			this.phrase = infoGroups[this.infoGroup].searchPhrase
			//console.log('********************************************************************************')
			// console.log({infoGroup: this.infoGroup, phrase: this.phrase})
			this.is2dArray = this.phrase.slice(-1) === '['
			this.l = this.phrase.length - 1
			
			// reset parameters:
			this.textData = ''
		}
	}
}
