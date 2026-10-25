# Project architecture

- Weekly summary date-window and due-time logic lives in the sending function's pure helper and is regression-tested with Vitest, so push and email use identical delivery rules.