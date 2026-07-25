"""
One-off admin utility: promote an already-registered user to the 'admin'
role. Run from the backend/ directory:

    python -m app.utils.make_admin you@example.com

There's deliberately no API endpoint for this — role escalation should
never be reachable over HTTP without an existing admin already gating it.
"""
import asyncio
import sys

sys.path.insert(0, ".")

from app.database import users_col  # noqa: E402


async def main(email: str):
    result = await users_col().update_one({"email": email}, {"$set": {"role": "admin"}})
    if result.matched_count == 0:
        print(f"No user found with email {email}")
    else:
        print(f"{email} is now an admin.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python -m app.utils.make_admin <email>")
        sys.exit(1)
    asyncio.run(main(sys.argv[1]))
