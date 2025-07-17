### Security
#### new_connection
* ***Parameters***: `{ public_key: JWK }`
* ***Returns***: `{ public_key: JWK, id: number }`
* ***Function***: Returns the servers public key, and a random id for the session
<br>**After this connection both sides have a shared secret, and each message is encrypted with it, and passes the clients id**

#### get_seed
* ***Parameters***: `{ username: string }`
* ***Returns***: `string`
* ***Function***: Returns a seed for the user, which is key

#### prove_seed
* ***Parameters***: `{ hashedSeed: string }`
* ***Returns***: `{ status: 'success'}`
* ***Function***: Proves to the server that the user is who they say they are

### Misc
#### Echo
* ***Parameters***: `{ data: any }`
* ***Returns***: `[the same data]`

### Files
#### get_file
* ***Parameters***: `{ file_name: string }`
* ***Returns***: (File exists) ? `{ status: 'success', file: any }` : `{ status: 'no_file' }`

#### save_file
* ***Parameters***: `{ file_name: string, data: string }`
* ***Returns***: `{ status: 'success' }`

#### delete_file
* ***Parameters***: `{ file_name: string }`
* ***Returns***: `{ status: 'success' }`