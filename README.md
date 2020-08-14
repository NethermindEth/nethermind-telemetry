# Nethermind telemetry
 
Based on [parity-telemetry](https://github.com/energywebfoundation/parity-telemetry).

Small NodeJS application to fetch information on new blocks from a Nethermind Ethereum node and pass it on to telegraf.

## Usage

1. Make sure that your Nethermind Node has JSON RPC and WebSockets correctly configured eg.

    - `Init.WebSocketsEnabled` -> is set to `true`
    - `JsonRpc.Enabled` -> is set to true

1. Run `npm install` to install the dependencies
2. Set following environment variables to configure:

    - `WSURL` -> websocket to Nethermind (eg. `ws://localhost:8545/ws/json-rpc`)
    - `HTTPURL` -> jsonrpc to Nethermind (eg. `http://localhost:8545`)
    - `PIPENAME` -> pipe/file to write metrics to (eg. `/tmp/output.pipe`)

3. Setup telegraf's `tail` pluigin as follows:

Change `/var/spool/nethermind.sock` to the path of the output pipe

```
[[inputs.tail]]
   files = ["/var/spool/nethermind.sock"]
   pipe = true
   data_format = "json"

   tag_keys = []
   json_time_key = "timekey"
   json_time_format = "unix_ms"
   json_string_fields = ["client","blockHash"]
   name_override = "nethermind"
```

4. Run the telemetry with `node src/index.js`
