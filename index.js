const Discord = require("discord.js")
const Wallet = require("./wallet")
const BitSong = require("./bitsong.js")
require('dotenv').config()

const discord = new Discord.Client()
const wallet = new Wallet()
const bitsong = new BitSong()

let privateKey, address

discord.on('ready', async () => {
    const {
        privateKey,
        address
    } = await wallet.recoverAccountFromMnemonic(process.env.FAUCET)

    pKey = privateKey
    addr = address

    console.log(`Wallet address: ${address}`);
});

discord.on('message', async message => {
    const msg = message.content.toLowerCase()

    if (msg.startsWith('i want bitsong')) {
        const address = msg.substring(15, 61)

        if (address.length < 46) {
            return
        }

        const payload = {
            to: address,
            amt: `100000000`
        }

        message.reply(`Sending 100btsg to: ${address}`);

        const response = await bitsong.send(
            payload,
            addr,
            "",
            pKey,
            0.25,
            200000
        );

        if (response.height > 0) {
            message.reply(`Tokens sent. Tx hash: ${response.txhash}`);
        } else {
            message.reply(`Tokens *not* not sent. Reason: ${response.raw_log}`);
        }
    }
});

discord.login(process.env.DISCORD);