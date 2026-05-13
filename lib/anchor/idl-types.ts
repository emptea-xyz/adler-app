/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/adler_escrow.json`.
 */
export type AdlerEscrow = {
  "address": "BArnn6qEM45LMxntW2eBKc5icsZGGqaLiDFCSTFx1uZr",
  "metadata": {
    "name": "adlerEscrow",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "docs": [
    "Adler bounty escrow — single-program bounty marketplace settlement.",
    "",
    "Each bounty escrows the poster's SOL into a PDA. Poster signs",
    "`settle_manual_bounty(winner)` to release funds. Anyone can call",
    "`refund_bounty` after `expires_at` (= create_time + 30-day submission",
    "window + 90-day review window). Everything else — name, description,",
    "media, status, submissions — lives off-chain in Firestore; the chain",
    "only holds what's needed to verifiably maintain custody."
  ],
  "instructions": [
    {
      "name": "cancelBounty",
      "docs": [
        "Poster-initiated cancel — refunds the escrow before `expires_at`.",
        "Off-chain layer (Firestore rules) gates this on the bounty having",
        "zero submissions; on-chain only enforces that the caller is the",
        "poster and the bounty hasn't refund-unlocked yet."
      ],
      "discriminator": [
        79,
        65,
        107,
        143,
        128,
        165,
        135,
        46
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  117,
                  110,
                  116,
                  121,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  117,
                  110,
                  116,
                  121,
                  95,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "poster"
              },
              {
                "kind": "arg",
                "path": "bountyId"
              }
            ]
          }
        },
        {
          "name": "poster",
          "writable": true,
          "signer": true,
          "relations": [
            "escrow"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "bountyId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "createBounty",
      "discriminator": [
        122,
        90,
        14,
        143,
        8,
        125,
        200,
        2
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  117,
                  110,
                  116,
                  121,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  117,
                  110,
                  116,
                  121,
                  95,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "poster"
              },
              {
                "kind": "arg",
                "path": "bountyId"
              }
            ]
          }
        },
        {
          "name": "poster",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "bountyId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "amountLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initProtocol",
      "discriminator": [
        3,
        188,
        141,
        237,
        225,
        226,
        232,
        210
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  117,
                  110,
                  116,
                  121,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "admin",
          "type": "pubkey"
        },
        {
          "name": "feeTreasury",
          "type": "pubkey"
        },
        {
          "name": "feeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "refundBounty",
      "discriminator": [
        167,
        234,
        121,
        108,
        247,
        216,
        216,
        124
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  117,
                  110,
                  116,
                  121,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  117,
                  110,
                  116,
                  121,
                  95,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "poster"
              },
              {
                "kind": "arg",
                "path": "bountyId"
              }
            ]
          }
        },
        {
          "name": "poster",
          "docs": [
            "`has_one = poster` on escrow. Not a signer: anyone can call refund",
            "after expiry (e.g. the off-chain `expireBounties` Cloud Function)."
          ],
          "writable": true,
          "relations": [
            "escrow"
          ]
        },
        {
          "name": "caller",
          "docs": [
            "Pays the tx fees. Doesn't have to be the poster."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "bountyId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "setPaused",
      "discriminator": [
        91,
        60,
        125,
        192,
        176,
        225,
        166,
        218
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  117,
                  110,
                  116,
                  121,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "settleManualBounty",
      "discriminator": [
        176,
        49,
        254,
        37,
        244,
        137,
        65,
        204
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  117,
                  110,
                  116,
                  121,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  117,
                  110,
                  116,
                  121,
                  95,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "poster"
              },
              {
                "kind": "arg",
                "path": "bountyId"
              }
            ]
          }
        },
        {
          "name": "poster",
          "writable": true,
          "signer": true,
          "relations": [
            "escrow"
          ]
        },
        {
          "name": "winner",
          "docs": [
            "and supplies the pubkey; this is by definition trusted in manual mode."
          ],
          "writable": true
        },
        {
          "name": "feeTreasury",
          "writable": true,
          "relations": [
            "escrow"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "bountyId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "updateProtocolField",
      "discriminator": [
        190,
        94,
        76,
        184,
        230,
        97,
        176,
        44
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  117,
                  110,
                  116,
                  121,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103,
                  95,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "field",
          "type": {
            "defined": {
              "name": "configField"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "bountyEscrow",
      "discriminator": [
        59,
        18,
        13,
        80,
        225,
        187,
        6,
        16
      ]
    },
    {
      "name": "protocolConfig",
      "discriminator": [
        207,
        91,
        250,
        28,
        152,
        179,
        215,
        209
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero."
    },
    {
      "code": 6001,
      "name": "protocolPaused",
      "msg": "Protocol is paused."
    },
    {
      "code": 6002,
      "name": "bountyExpired",
      "msg": "Bounty has expired; only refund is allowed."
    },
    {
      "code": 6003,
      "name": "refundBeforeExpiry",
      "msg": "Bounty has not yet expired; refund is not allowed."
    },
    {
      "code": 6004,
      "name": "bountyIdMismatch",
      "msg": "bounty_id arg does not match the PDA's bounty_id."
    },
    {
      "code": 6005,
      "name": "posterMismatch",
      "msg": "Poster pubkey on the instruction does not match the PDA's poster."
    },
    {
      "code": 6006,
      "name": "feeTreasuryMismatch",
      "msg": "Fee treasury pubkey does not match ProtocolConfig.fee_treasury."
    },
    {
      "code": 6007,
      "name": "overflow",
      "msg": "Arithmetic overflow."
    },
    {
      "code": 6008,
      "name": "alreadyInitialized",
      "msg": "Singleton PDA is already initialized."
    }
  ],
  "types": [
    {
      "name": "bountyEscrow",
      "docs": [
        "Per-bounty escrow PDA. Holds `amount + fee + rent` lamports until",
        "terminal (settle or refund — both close the PDA).",
        "",
        "Seeds: `[b\"bounty_v2\", poster.key().as_ref(), &bounty_id]`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "poster",
            "type": "pubkey"
          },
          {
            "name": "bountyId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "amountLamports",
            "docs": [
              "Amount paid out to the winner on settle (or refunded to poster)."
            ],
            "type": "u64"
          },
          {
            "name": "feeLamports",
            "docs": [
              "`floor(amount_lamports * config.fee_bps / 10_000)`, snapshotted at",
              "create time. Sent to fee_treasury on settle. Returned to poster on",
              "refund."
            ],
            "type": "u64"
          },
          {
            "name": "feeTreasury",
            "docs": [
              "Snapshotted from `ProtocolConfig.fee_treasury` at create time."
            ],
            "type": "pubkey"
          },
          {
            "name": "expiresAt",
            "docs": [
              "`now + SUBMISSION_WINDOW_SECS + REVIEW_WINDOW_SECS` at create.",
              "After this slot timestamp, `refund_bounty` can be called by anyone."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "configField",
      "docs": [
        "Single-field update enum for `update_protocol_field`. Per-field typing",
        "keeps audit logs precise."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "admin",
            "fields": [
              {
                "name": "value",
                "type": "pubkey"
              }
            ]
          },
          {
            "name": "feeBps",
            "fields": [
              {
                "name": "value",
                "type": "u16"
              }
            ]
          },
          {
            "name": "feeTreasury",
            "fields": [
              {
                "name": "value",
                "type": "pubkey"
              }
            ]
          }
        ]
      }
    },
    {
      "name": "protocolConfig",
      "docs": [
        "Singleton protocol policy. Stores tunable fields and the kill switch.",
        "Seeds: `[b\"bounty_config_v2\"]`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "docs": [
              "Pubkey allowed to call `update_protocol_field` and `set_paused`."
            ],
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "docs": [
              "Protocol fee in basis points (default 50 = 0.5 %)."
            ],
            "type": "u16"
          },
          {
            "name": "feeTreasury",
            "docs": [
              "Lamport sink for protocol fees. Snapshotted onto every bounty at",
              "create time."
            ],
            "type": "pubkey"
          },
          {
            "name": "paused",
            "docs": [
              "Kill switch. When `true`, settlement-mutating ix early-return with",
              "`ProtocolPaused`."
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
