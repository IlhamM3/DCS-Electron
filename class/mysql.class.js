// from here -> https://codeburst.io/node-js-mysql-and-promises-4c3be599909b
'use strict';
const mysql = require( 'mysql' );
const md5 = require( 'md5' );

class Database {
    constructor( config ) {
			//~ console.log(global);
			if(global.__sqlConfigs === undefined){
				global.__sqlConfigs = [];
			}

			if(global.__sqlConnection === undefined){
				global.__sqlConnection = {};
			}

			this.config = config;
			this.config.dateStrings = true;
			if(this.config.gracefulExit === undefined)
				this.config.gracefulExit= true;

			this.config_hash = md5(JSON.stringify(config));
			if(!__sqlConfigs.includes(this.config_hash)){
				__sqlConfigs.push(this.config_hash);
				__sqlConnection[this.config_hash] = mysql.createPool( this.config );
			}
    }

    query( sql, args) {
			let ini = this;

			return new Promise(async ( resolve, reject ) => {
				//just in case. Limit query executed only for data manipulation only
				if(sql.match(/(CREATE|TRUNCATE|GRANT|DROP|ALTER|SHUTDOWN)/)){
					return reject(["SQL Query contains forbidden words : CREATE,TRUNCATE,GRANT,DROP,ALTER,SHUTDOWN"]);
				}

				let __error=false;
				let __rows;

				if(!__sqlConfigs.includes(this.config_hash)){
					__sqlConnection[this.config_hash] = mysql.createPool( this.config );
				}

				//~ console.dir(__sqlConnection);
				this.connection = __sqlConnection[this.config_hash];
				this.connection.getConnection(function(err,conn){
					if(err){
						return reject(err);
					}
					conn.query(sql,args,async(err,rows)=>{
						conn.release();

						if(err){
							return reject(err);
						}

						if(rows.length!== null && rows.length == 0)
							return reject(["Empty Result"]);

						resolve( rows );
					});
				});

			});
		}

    open() {
			let ini = this;

			//~ this.connection = mysql.createConnection( this.config );
			this.connection = mysql.createPool( this.config );

			this.connection.on('error', async function(err) {
				console.error('iki error',err.code); // 'ER_BAD_DB_ERROR'
				//~ if(err.code === 'ER_CON_COUNT_ERROR'){
					await this.connection.end();
				//~ }
				console.log('connection restarted');
				await ini.open();
			});
    }

    close() {
        return new Promise( ( resolve, reject ) => {
            this.connection.end( err => {
                if ( err )
                    return reject( err );
                resolve();
            } );
        } );
    }

    execute(sql, param=[], inArray = false){
      //return query not as promise, but as a dircet value
      return this.query(sql,param)
      .then(results=>{
				//~ console.log(results);
				//~ try{
					if(!Array.isArray(results) && results instanceof Object)
						return results;
				//~ }
				//~ catch{
					else
						return (results.length>1 || inArray)?(results):(results[0]);
				//~ }
			})
			.catch(error=>{
				return {__ERROR__:error};
			});
    }

    escape(string){
      return this.connection.escape(string);
    }
}

module.exports = Database;
