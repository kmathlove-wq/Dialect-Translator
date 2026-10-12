@echo off
chcp 65001 > nul
title 방언번역기
cd /d "%~dp0"
node scripts\local.mjs
pause
