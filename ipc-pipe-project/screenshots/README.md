# Screenshots

This folder is intentionally empty. Screenshots must be **genuine
captures of your own terminal**, so they have to be taken by the team on
the machine used for the demonstration. (The text logs in `../results/`
are real program output and can be regenerated with `make results`.)

Suggested captures — save them here with these names:

| File | Command to run before capturing |
|---|---|
| `01_build.png` | `make clean && make` |
| `02_parent_to_child.png` | `./ipc_pipe 1` |
| `03_child_to_parent.png` | `./ipc_pipe 2` |
| `04_bidirectional.png` | `./ipc_pipe 3` |
| `05_multiple_messages.png` | `./ipc_pipe 4` |
| `06_bulk_transfer.png` | `./ipc_pipe 5` |
| `07_eof_and_wait.png` | `./ipc_pipe 6` |
| `08_broken_pipe.png` | `./ipc_pipe 7` |
| `09_chat.png` | `./ipc_pipe 8` (type two messages, then `exit`) |
| `10_invalid_input.png` | `./ipc_pipe 99; echo $?` |
| `11_tests.png` | `make test` |
| `12_no_zombies.png` | `./ipc_pipe all; ps -eo pid,stat,comm \| grep ipc_pipe` |

How to capture: on Windows/WSL press `Win + Shift + S`; on Ubuntu press
`Shift + PrtSc` (or `PrtSc` and select the area).

Then:

```bash
git add screenshots
```

```bash
git commit -m "Add terminal screenshots"
```

```bash
git push
```
