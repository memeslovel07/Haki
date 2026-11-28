# HAKI CLI

`haki` is a globally installable CLI. Local Git commands are passed to the installed `git` executable. A `haki://` remote syncs snapshots with HAKI's backend workspace API.

## Build and install

From the repository root, build the executable, then link it globally:

```sh
npm --workspace @haki/cli run build
cd cli
npm link
```

Open a new terminal if needed. Sign in with a HAKI email/password account, then list or clone HAKI repositories:

```sh
haki login
haki repos
haki clone haki://<repository-id>
cd <repository-name>
haki status
haki add .
haki commit -m "Describe the change"
haki push
haki fetch
haki pull
```

For an existing local Git checkout, connect a HAKI workspace repository with `haki remote add origin haki://<repository-id>`. Use `haki remote remove origin` to disconnect the local checkout before connecting a different HAKI repository; this does not delete remote data. HAKI `push` publishes the current clean Git commit as one backend snapshot. `pull` updates a clean checkout and records the pulled files as a local Git commit. A changed HAKI head or workspace blocks push until you fetch and pull. Each HAKI snapshot supports files up to 2 MB and 25 MB total.

Normal Git remotes keep working too. `haki clone https://github.com/owner/repository.git`, `haki push`, and `haki fetch` use native Git unless the current checkout has a configured `haki://` remote. Other Git commands, including `branch`, `switch`, `merge`, `log`, `tag`, `stash`, and `rebase`, are passed through unchanged. You can also keep using `git` directly.

GitHub-only HAKI accounts without a password cannot use CLI login yet. Use an email/password HAKI account. GitHub OAuth device login can be added later.
