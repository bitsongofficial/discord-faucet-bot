const BitSongClient = require("@bitsongofficial/js-sdk")

class Wallet {
    constructor() {
        this._client = new BitSongClient()
        this._crypto = BitSongClient.crypto
    }

    recoverAccountFromMnemonic = async (mnemonic) => {
        return await this._client.recoverAccountFromMnemonic(mnemonic)
    }
}

module.exports = Wallet
