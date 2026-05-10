// Auto-generated from adler-program/target/idl/adler_escrow.json — do not edit.

import type { AdlerEscrow } from "./idl-types";

// Anchor 0.31's IDL JSON keeps Rust snake_case names while the generated
// idl-types.ts uses camelCase — the discrepancy is intentional in the
// upstream codegen. Cast through unknown so the typed client surface
// (program.methods.createBounty(...) etc.) remains correct.
const idlRaw =
{
  "address": "BArnn6qEM45LMxntW2eBKc5icsZGGqaLiDFCSTFx1uZr",
  "metadata": {
    "name": "adler_escrow",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "docs": [
    "Adler bounty escrow — single-program bounty marketplace settlement.",
    "",
    "Each bounty escrows the poster's SOL into a PDA. Manual mode: poster",
    "signs `settle_manual_bounty(winner)`. Auto mode: a custodial verifier",
    "keypair (held by the off-chain Cloud Function) signs",
    "`settle_auto_bounty(winner)` after Gemini Vision verifies the photo.",
    "Anyone can call `refund_bounty` after `expires_at` (poster + 30 days)."
  ],
  "instructions": [
    {
      "name": "create_bounty",
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
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
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
                  121
                ]
              },
              {
                "kind": "account",
                "path": "poster"
              },
              {
                "kind": "arg",
                "path": "bounty_id"
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
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "bounty_id",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "amount_lamports",
          "type": "u64"
        },
        {
          "name": "mode",
          "type": "u8"
        }
      ]
    },
    {
      "name": "init_protocol",
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
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
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
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "admin",
          "type": "pubkey"
        },
        {
          "name": "verifier_pubkey",
          "type": "pubkey"
        },
        {
          "name": "fee_treasury",
          "type": "pubkey"
        },
        {
          "name": "fee_bps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "refund_bounty",
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
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
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
                  121
                ]
              },
              {
                "kind": "account",
                "path": "poster"
              },
              {
                "kind": "arg",
                "path": "bounty_id"
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
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "bounty_id",
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
      "name": "set_paused",
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
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
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
      "name": "settle_auto_bounty",
      "discriminator": [
        100,
        186,
        88,
        99,
        6,
        180,
        124,
        167
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
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
                  121
                ]
              },
              {
                "kind": "account",
                "path": "poster"
              },
              {
                "kind": "arg",
                "path": "bounty_id"
              }
            ]
          }
        },
        {
          "name": "poster",
          "writable": true,
          "relations": [
            "escrow"
          ]
        },
        {
          "name": "verifier",
          "docs": [
            "Custodial verifier keypair held by the Cloud Function. Must equal",
            "`config.verifier_pubkey`."
          ],
          "signer": true
        },
        {
          "name": "winner",
          "docs": [
            "submitter's pubkey after Gemini Vision passes the photo against the",
            "bounty prompt."
          ],
          "writable": true
        },
        {
          "name": "fee_treasury",
          "writable": true,
          "relations": [
            "escrow"
          ]
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "bounty_id",
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
      "name": "settle_manual_bounty",
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
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
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
                  121
                ]
              },
              {
                "kind": "account",
                "path": "poster"
              },
              {
                "kind": "arg",
                "path": "bounty_id"
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
          "name": "fee_treasury",
          "writable": true,
          "relations": [
            "escrow"
          ]
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "bounty_id",
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
      "name": "update_protocol_field",
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
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
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
              "name": "ConfigField"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "BountyEscrow",
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
      "name": "ProtocolConfig",
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
      "name": "InvalidAmount",
      "msg": "Amount must be greater than zero."
    },
    {
      "code": 6001,
      "name": "InvalidMode",
      "msg": "Mode must be 0 (Manual) or 1 (Auto)."
    },
    {
      "code": 6002,
      "name": "ProtocolPaused",
      "msg": "Protocol is paused."
    },
    {
      "code": 6003,
      "name": "BountyExpired",
      "msg": "Bounty has expired; only refund is allowed."
    },
    {
      "code": 6004,
      "name": "RefundBeforeExpiry",
      "msg": "Bounty has not yet expired; refund is not allowed."
    },
    {
      "code": 6005,
      "name": "WrongVerifier",
      "msg": "Wrong verifier signer; must equal config.verifier_pubkey."
    },
    {
      "code": 6006,
      "name": "BountyIdMismatch",
      "msg": "bounty_id arg does not match the PDA's bounty_id."
    },
    {
      "code": 6007,
      "name": "PosterMismatch",
      "msg": "Poster pubkey on the instruction does not match the PDA's poster."
    },
    {
      "code": 6008,
      "name": "FeeTreasuryMismatch",
      "msg": "Fee treasury pubkey does not match ProtocolConfig.fee_treasury."
    },
    {
      "code": 6009,
      "name": "NotAutoMode",
      "msg": "This instruction is for auto-mode bounties only."
    },
    {
      "code": 6010,
      "name": "NotManualMode",
      "msg": "This instruction is for manual-mode bounties only."
    },
    {
      "code": 6011,
      "name": "Overflow",
      "msg": "Arithmetic overflow."
    },
    {
      "code": 6012,
      "name": "AlreadyInitialized",
      "msg": "Singleton PDA is already initialized."
    }
  ],
  "types": [
    {
      "name": "BountyEscrow",
      "docs": [
        "Per-bounty escrow PDA. Holds `amount + fee + rent` lamports until",
        "terminal (settle or refund — both close the PDA).",
        "",
        "Seeds: `[b\"bounty\", poster.key().as_ref(), &bounty_id]`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "poster",
            "type": "pubkey"
          },
          {
            "name": "bounty_id",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "amount_lamports",
            "docs": [
              "Amount paid out to the winner on settle (or refunded to poster)."
            ],
            "type": "u64"
          },
          {
            "name": "fee_lamports",
            "docs": [
              "`floor(amount_lamports * config.fee_bps / 10_000)`, snapshotted at",
              "create time. Sent to fee_treasury on settle. Returned to poster on",
              "refund."
            ],
            "type": "u64"
          },
          {
            "name": "fee_treasury",
            "docs": [
              "Snapshotted from `ProtocolConfig.fee_treasury` at create time."
            ],
            "type": "pubkey"
          },
          {
            "name": "mode",
            "docs": [
              "0 = Manual (poster signs settle), 1 = Auto (verifier_pubkey signs)."
            ],
            "type": "u8"
          },
          {
            "name": "expires_at",
            "docs": [
              "`now + BOUNTY_EXPIRY_SECS` at create. After this slot timestamp,",
              "`refund_bounty` can be called by anyone."
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
      "name": "ConfigField",
      "docs": [
        "Single-field update enum for `update_protocol_field`. Per-field typing",
        "keeps audit logs precise."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Admin",
            "fields": [
              {
                "name": "value",
                "type": "pubkey"
              }
            ]
          },
          {
            "name": "VerifierPubkey",
            "fields": [
              {
                "name": "value",
                "type": "pubkey"
              }
            ]
          },
          {
            "name": "FeeBps",
            "fields": [
              {
                "name": "value",
                "type": "u16"
              }
            ]
          },
          {
            "name": "FeeTreasury",
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
      "name": "ProtocolConfig",
      "docs": [
        "Singleton protocol policy. Stores tunable fields and the kill switch.",
        "Seeds: `[b\"config\"]`."
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
            "name": "verifier_pubkey",
            "docs": [
              "Custodial verifier keypair held by the off-chain Cloud Function.",
              "Required signer for `settle_auto_bounty`. Set at init; rotatable via",
              "`update_protocol_field`."
            ],
            "type": "pubkey"
          },
          {
            "name": "fee_bps",
            "docs": [
              "Protocol fee in basis points (default 50 = 0.5 %)."
            ],
            "type": "u16"
          },
          {
            "name": "fee_treasury",
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

const idl = idlRaw as unknown as AdlerEscrow;
export default idl;
