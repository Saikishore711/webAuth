const express = require('express')
const crypto = require("node:crypto");
const { 
    generateRegistrationOptions, 
    verifyRegistrationResponse, 
    generateAuthenticationOptions, 
    verifyAuthenticationResponse 
} = require('@simplewebauthn/server')

const base64url = require('base64url');

if (!globalThis.crypto) {
    globalThis.crypto = crypto;
}

const PORT = 3000
const app = express();

app.use(express.static('./public'))
app.use(express.json())

// States
const userStore = {}
const challengeStore = {}

app.post('/register', (req, res) => {
    const { username, password } = req.body
    const id = `user_${Date.now()}`

    const user = {
        id,
        username,
        password
    }

    userStore[id] = user

    console.log(`Register successfull`, userStore[id])

    return res.json({ id })

})

app.post('/register-challenge', async (req, res) => {
    const { userId } = req.body

    if (!userStore[userId]) return res.status(404).json({ error: 'user not found!' })

    const user = userStore[userId]

    const challengePayload = await generateRegistrationOptions({
        rpID: 'localhost',
        rpName: 'My Localhost Machine',
        attestationType: 'none',
        userName: user.username,
        timeout: 30_000,
    })

    challengeStore[userId] = challengePayload.challenge

    return res.json({ options: challengePayload })

})
app.post('/register-verify', async (req, res) => {
    const { userId, cred } = req.body;

    if (!userStore[userId]) {
        return res.status(404).json({ error: 'user not found!' });
    }

    const user = userStore[userId];
    const challenge = challengeStore[userId];

    const verificationResult = await verifyRegistrationResponse({
        expectedChallenge: challenge,
        expectedOrigin: 'http://localhost:3000',
        expectedRPID: 'localhost',
        response: cred,
    });

    if (!verificationResult.verified || !verificationResult.registrationInfo) {
        return res.status(400).json({ error: 'could not verify' });
    }

    const {
        credential: {
            id,
            publicKey,
            counter,
            transports
        },
        credentialDeviceType,
        credentialBackedUp
    } = verificationResult.registrationInfo;

    userStore[userId].passkey = {
        credentialID: Buffer.from(id, 'base64url'),           // Required: Buffer
        credentialPublicKey: Buffer.from(publicKey),          // Already Uint8Array or Buffer
        counter,
        transports,
        credentialDeviceType,
        credentialBackedUp,
    };

    return res.json({ verified: true });
});

app.post('/login-challenge', async (req, res) => {
    const { userId } = req.body
    if (!userStore[userId]) return res.status(404).json({ error: 'user not found!' })
    
    const opts = await generateAuthenticationOptions({
        rpID: 'localhost',
    })

    challengeStore[userId] = opts.challenge

    return res.json({ options: opts })
})

app.post('/login-verify', async (req, res) => {
    const { userId, cred } = req.body;

    if (!userStore[userId]) {
        return res.status(404).json({ error: 'user not found!' });
    }

    const user = userStore[userId];
    const challenge = challengeStore[userId];

    try {
        const result = await verifyAuthenticationResponse({
            expectedChallenge: challenge,
            expectedOrigin: 'http://localhost:3000',
            expectedRPID: 'localhost',
            response: cred, // Keep rawId as base64url string
            credential: {
                id: user.passkey.credentialID,
                publicKey: user.passkey.credentialPublicKey,
                counter: user.passkey.counter,
                transports: user.passkey.transports,
              },
        });


        if (!result.verified) {
            return res.status(400).json({ error: 'could not verify login' });
        }

        return res.json({ success: true, userId });

    } catch (err) {
        console.error('Login verification error:', err);
        return res.status(500).json({ error: 'server error during login' });
    }
});




app.listen(PORT, () => console.log(`Server started on PORT:${PORT}`))