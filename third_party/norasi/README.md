# Norasi Bold (unmodified original)

This folder holds the unmodified upstream file that `tools/plate_fonts.py` reads to build the plate fonts
in `src/assets/fonts/` (`NorasiBold-PlateSubset.woff2` and `NorasiBold-PlateSubset-ShortTail.woff2`).
Nothing here is imported by the app or copied into `dist/`.

| File | Origin | sha256 |
|---|---|---|
| `Norasi-Bold.ttf` | `ttf-tlwg-0.7.4.tar.xz` from https://github.com/tlwg/fonts-tlwg/releases (tag v0.7.4) | `cdbce4c80e378f04d863490bef3e31cd611eef96b687aa9976bc2844d112f8c8` |
| `COPYING` | `fonts-tlwg-0.7.4.tar.xz` (same release), copyright notices + font exception | `87404cd84fa22bb13e30142dc81d9d2e1f1320799dfb3750140470c2b74c220d` |
| `GPL` | `fonts-tlwg-0.7.4.tar.xz` (same release), GNU GPL version 2 | `c38aee9e3c8c4d5d594ff548a1be05453023016d6286931f6512db215ec1fd42` |

Release archives used (sha256):

- `ttf-tlwg-0.7.4.tar.xz` `e1afa592660a48234051a8c6b54aff36b85db8da0299878ed4d1668a2bda3c57`
- `fonts-tlwg-0.7.4.tar.xz` `2531d3e02de1d293e4a9f8527ac4d3d044a845f49dc2d314c5766b4f68730735`

License: GNU General Public License version 2 or later, with the font exception (see `COPYING`).
The upstream editable source (`nf/Norasi-Bold.sfd`) is in `fonts-tlwg-0.7.4.tar.xz`. The modified files in
`src/assets/fonts/` are made from `Norasi-Bold.ttf` here plus `tools/plate_fonts.py`. That pair is the
corresponding source of the modification. The changes are listed in
`src/assets/fonts/NorasiBold-PlateSubset-NOTICE.txt`.
