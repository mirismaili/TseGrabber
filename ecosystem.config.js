module.exports = {
	apps: [{
		script: 'main.js',
		autorestart: false,
		time: true,
		cwd: __dirname,
		node_args: '--max_old_space_size=4096',
		env: {
			DB_URI: 'postgres://postgres@e900.ir:50321/tse', //'postgres://postgres:SdFv6iKWuHB7RX0E@37.152.186.255/tse',
			MONGO_DB_URI: 'mongodb+srv://admin:SdFv6iKWuHB7RX0E@cluster0-utnpk.mongodb.net/tse?retryWrites=true&w=majority',
		},
	}],
}
