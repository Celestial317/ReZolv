"""Optional: anchor a SHA-256 of a report/promise on Solana devnet (Memo program).

Only the hash goes on-chain. Without SOLANA_KEYPAIR_PATH this just records the
hash in the `anchors` table. Install `solana` and `solders` to enable sending.
"""
import hashlib
import json
import logging
from pathlib import Path

import db
from config import settings

log = logging.getLogger("rezolv.solana")
MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"


def enabled() -> bool:
    return bool(settings.solana_keypair_path)


def sha256_of(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode()).hexdigest()


def anchor(entity_type: str, entity_id, *parts: str) -> None:
    digest = sha256_of(str(entity_id), *parts)
    row = db.fetchone(
        "INSERT INTO anchors (entity_type, entity_id, sha256) VALUES (%s,%s,%s) RETURNING id",
        (entity_type, entity_id, digest),
    )
    if not enabled():
        return
    try:
        sig = _send_memo(digest)
        db.execute("UPDATE anchors SET solana_sig=%s WHERE id=%s", (sig, row["id"]))
    except Exception:
        log.exception("Solana memo failed")


def _send_memo(text: str) -> str:
    from solana.rpc.api import Client
    from solders.instruction import AccountMeta, Instruction
    from solders.keypair import Keypair
    from solders.message import Message
    from solders.pubkey import Pubkey
    from solders.transaction import Transaction

    kp = Keypair.from_bytes(bytes(json.loads(Path(settings.solana_keypair_path).read_text())))
    client = Client(settings.solana_rpc_url)
    ix = Instruction(
        Pubkey.from_string(MEMO_PROGRAM), text.encode(), [AccountMeta(kp.pubkey(), True, True)]
    )
    blockhash = client.get_latest_blockhash().value.blockhash
    tx = Transaction([kp], Message([ix], kp.pubkey()), blockhash)
    return str(client.send_transaction(tx).value)
