#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FC MANAGER — TESTES DE PRIVACIDADE DOS DADOS PUBLICADOS

Garante que nada publicado no GitHub Pages expõe o save pessoal:
  - nenhum arquivo binário de save versionado (saves/ só contém .gitkeep);
  - nenhum nome/caminho real de save (CmMgr...) nos dados publicados;
  - o export público não carrega save_path nem available_saves;
  - a sanitização do pipeline (save_parser.sanitize_for_public_export) funciona.

Uso:
  python -m unittest tests/test_public_data_privacy.py -v
"""

import json
import os
import re
import subprocess
import sys
import unittest

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(TESTS_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src import save_parser  # noqa: E402

SAVE_NAME_RE = re.compile(r"CmMgr[A-Za-z]?\d{6,}")
PUBLISHED_DATA = [
    os.path.join("assets", "data", "career_data.json"),
    os.path.join("assets", "data", "career_data.js"),
    os.path.join("assets", "data", "careers_archive.json"),
    os.path.join("assets", "data", "baseline_snapshot.json"),
    os.path.join("exports", "Estatisticas_Jogadores_FC_Andorra_Carreira.csv"),
]


def git_tracked_files():
    res = subprocess.run(["git", "ls-files"], cwd=PROJECT_ROOT, capture_output=True, text=True)
    if res.returncode != 0:
        return None
    return [line.strip() for line in res.stdout.splitlines() if line.strip()]


class TestPublicDataPrivacy(unittest.TestCase):

    def test_30_no_binary_save_is_tracked(self):
        """saves/ deve conter apenas .gitkeep e nenhum CmMgr* pode estar versionado."""
        tracked = git_tracked_files()
        if tracked is None:
            self.skipTest("Repositório Git indisponível")
        in_saves = [f for f in tracked if f.startswith("saves/")]
        self.assertEqual(in_saves, ["saves/.gitkeep"], f"Arquivos versionados em saves/: {in_saves}")
        save_like = [f for f in tracked if os.path.basename(f).startswith("CmMgr")]
        self.assertEqual(save_like, [], f"Arquivos de save versionados: {save_like}")

    def test_31_published_data_has_no_save_identifiers(self):
        """Nenhum dado publicado pode conter o nome real de um save (CmMgr + timestamp)."""
        for rel in PUBLISHED_DATA:
            path = os.path.join(PROJECT_ROOT, rel)
            if not os.path.exists(path):
                continue
            with open(path, "r", encoding="utf-8-sig", errors="replace") as f:
                content = f.read()
            found = SAVE_NAME_RE.findall(content)
            self.assertEqual(found, [], f"{rel} expõe identificador de save: {sorted(set(found))}")

    def test_32_public_json_has_no_save_metadata_keys(self):
        """career_data.json publicado não pode conter save_path, available_saves nem ultimo_save."""
        with open(os.path.join(PROJECT_ROOT, "assets", "data", "career_data.json"), encoding="utf-8") as f:
            data = json.load(f)
        self.assertNotIn("save_path", data)
        self.assertNotIn("available_saves", data)
        self.assertEqual(data.get("save_file"), save_parser.PUBLIC_SAVE_LABEL)
        for entry in data.get("careers_archive_summary", []):
            self.assertNotIn("ultimo_save", entry)

    def test_33_pipeline_sanitizer_strips_metadata(self):
        """sanitize_for_public_export remove metadados sem alterar o dicionário original."""
        original = {
            "save_file": "CmMgrC20990101000000000",
            "save_path": "saves/CmMgrC20990101000000000",
            "available_saves": [{"filename": "CmMgrC20990101000000000", "mtime": 1}],
            "careers_archive_summary": [{"clube": "X", "ultimo_save": "CmMgrC20990101000000000"}],
            "club": {"nome": "X"},
        }
        public = save_parser.sanitize_for_public_export(original)
        self.assertEqual(public["save_file"], save_parser.PUBLIC_SAVE_LABEL)
        self.assertNotIn("save_path", public)
        self.assertNotIn("available_saves", public)
        self.assertNotIn("ultimo_save", public["careers_archive_summary"][0])
        self.assertIsNone(SAVE_NAME_RE.search(json.dumps(public)))
        # Original intacto (a cópia local completa continua disponível para o servidor)
        self.assertEqual(original["save_path"], "saves/CmMgrC20990101000000000")

    def test_34_local_full_copy_is_git_ignored(self):
        """A cópia local completa (assets/data/local/) precisa estar no .gitignore."""
        res = subprocess.run(
            ["git", "check-ignore", "-q", "assets/data/local/career_data.local.json"],
            cwd=PROJECT_ROOT, capture_output=True, text=True
        )
        self.assertEqual(res.returncode, 0, "assets/data/local/ não está ignorado pelo Git")


if __name__ == "__main__":
    unittest.main(verbosity=2)
