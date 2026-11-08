# Project workflow

When the user asks to commit (including "commint" or "commnit"), treat that as authorization to stage the intended project changes and create a local Git commit. Choose a concise, descriptive commit message automatically. Do not ask for routine confirmation or a commit message.

Review the diff before committing. Exclude credentials, secrets, generated files, and unrelated changes. Ask only when a real ambiguity or blocker prevents a safe commit. Do not push to a remote unless the user requests it.
