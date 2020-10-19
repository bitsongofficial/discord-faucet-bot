const fetch = require("node-fetch")
const secp256k1 = require("secp256k1")
const crypto = require("crypto")
const bitcoinjs = require("bitcoinjs-lib")
const createHash = require("create-hash")
const BigNumber = require('bignumber.js')
require('dotenv').config()


function sortObject(obj) {
    if (obj === null) return null
    if (typeof obj !== "object") return obj
    if (Array.isArray(obj)) return obj.map(sortObject)
    const sortedKeys = Object.keys(obj).sort()
    const result = {}
    sortedKeys.forEach(key => {
        result[key] = sortObject(obj[key])
    })
    return result
}

class BitSong {
    constructor() {
        this.url = process.env.LCD_TX
        this.chainId = process.env.CHAIN_ID
        this.path = "m/44'/118'/0'/0/0"
        this.bech32MainPrefix = process.env.BECH32_PREFIX

        if (!this.url) {
            throw new Error("url object was not set or invalid")
        }
        if (!this.chainId) {
            throw new Error("chainId object was not set or invalid")
        }
    }

    sha2(data) {
        return createHash("sha256")
            .update(data)
            .digest()
    }

    xor(a, b) {
        if (!Buffer.isBuffer(a)) a = Buffer(a)
        if (!Buffer.isBuffer(b)) b = Buffer(b)
        let res = []
        let length = Math.min(a.length, b.length)
        for (let i = 0; i < length; i++) {
            res.push(a[i] ^ b[i])
        }
        return Buffer(res)
    }

    getECPairPrivFromPK(privateKey) {
        if (typeof privateKey !== "string") {
            throw new Error("privateKey expects a string")
        }

        const buf = Buffer.from(privateKey, "hex")

        const ecpair = bitcoinjs.ECPair.fromPrivateKey(buf, {
            compressed: false
        })

        return ecpair.privateKey
    }

    convertStringToBytes(str) {
        if (typeof str !== "string") {
            throw new Error("str expects a string")
        }
        var myBuffer = []
        var buffer = Buffer.from(str, "utf8")
        for (var i = 0; i < buffer.length; i++) {
            myBuffer.push(buffer[i])
        }
        return myBuffer
    }

    getPubKeyBase64(ecpairPriv) {
        const pubKeyByte = secp256k1.publicKeyCreate(ecpairPriv)
        return Buffer.from(pubKeyByte, "binary").toString("base64")
    }

    sign(stdSignMsg, ecpairPriv, modeType = "sync") {
        // The supported return types includes "block"(return after tx commit), "sync"(return afer CheckTx) and "async"(return right away).
        let signMessage = new Object()
        signMessage = stdSignMsg.json

        const hash = crypto
            .createHash("sha256")
            .update(JSON.stringify(sortObject(signMessage)))
            .digest("hex")
        const buf = Buffer.from(hash, "hex")

        let signObj = secp256k1.sign(buf, ecpairPriv)
        var signatureBase64 = Buffer.from(signObj.signature, "binary").toString(
            "base64"
        )
        let signedTx = new Object()

        signedTx = {
            tx: {
                msg: stdSignMsg.json.msgs,
                signatures: [{
                    pub_key: {
                        type: "tendermint/PubKeySecp256k1",
                        value: this.getPubKeyBase64(ecpairPriv)
                    },
                    signature: signatureBase64,
                }],
                memo: stdSignMsg.json.memo,
                fee: stdSignMsg.json.fee
                // chain_id: stdSignMsg.json.chain_id,
                // account_number: stdSignMsg.json.account_number,
                // sequence: stdSignMsg.json.sequence,
            },
            mode: modeType
        }

        return signedTx
    }

    broadcast(signedTx) {
        return fetch(`${this.url}/txs`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(signedTx)
        }).then(response => response.json())
    }

    NewStdMsg(msgs, account_number, sequence, memo = "", gas_price, gas_limit) {
        const stdSignMsg = new Object()

        if (sequence === undefined) {
            sequence = "0"
        }

        stdSignMsg.json = {
            account_number: String(account_number),
            chain_id: this.chainId,
            fee: {
                amount: [{
                    amount: new BigNumber(gas_price).multipliedBy(gas_limit).toString(),
                    denom: "ubtsg"
                }],
                gas: String(gas_limit)
            },
            memo: memo,
            msgs: msgs,
            sequence: String(sequence)
        }

        stdSignMsg.bytes = this.convertStringToBytes(
            JSON.stringify(sortObject(stdSignMsg.json))
        )

        return stdSignMsg
    }

    getAccount(address) {
        return fetch(`${this.url}/auth/accounts/${address}`).then(response =>
            response.json()
        )
    }

    async send({ to, amt }, from, memo, pk, gas_price, gas_limit) {
        const account = await this.getAccount(from)
        const account_number = account.result.value.account_number
        const sequence = account.result.value.sequence
        const ecpairPriv = await this.getECPairPrivFromPK(pk)

        const msgs = [{
            type: "cosmos-sdk/MsgSend",
            value: {
                from_address: from,
                to_address: to,
                amount: [
                    {
                        denom: "ubtsg",
                        amount: String(amt)
                    }
                ]
            }
        }]

        const stdSignMsg = await this.NewStdMsg(msgs, account_number, sequence, memo, gas_price, gas_limit)
        const signedTx = await this.sign(stdSignMsg, ecpairPriv, process.env.SIGN_MODE_TYPE)

        return await this.broadcast(signedTx)
    }

}

module.exports = BitSong
