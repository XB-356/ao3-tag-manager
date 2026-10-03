"""CSS 粗校验：大括号配平、UTF-8 无损、无替换符、深色适配覆盖到位。"""
import io
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
FILES = ["src/lib/panel.css", "src/popup/popup.css"]

failures = []

for rel in FILES:
    path = os.path.join(ROOT, rel)
    with io.open(path, "r", encoding="utf-8") as fh:
        text = fh.read()

    stripped = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    opens = stripped.count("{")
    closes = stripped.count("}")
    if opens != closes:
        failures.append("%s: 大括号不配平 { = %d, } = %d" % (rel, opens, closes))

    if "\ufffd" in text:
        failures.append("%s: 存在替换符" % rel)

    if rel.endswith("panel.css"):
        # 页内注入元素：深色由内容脚本实测页面背景后写入的属性驱动
        for needle in ["html[data-ao3tm-theme='dark']", "--ao3tm-accent-tint", "--ao3tm-bg-soft"]:
            if needle not in text:
                failures.append("%s: 缺少 %s" % (rel, needle))
        if "data-ao3tm-theme" not in text:
            failures.append("%s: 缺少主题属性选择器" % rel)
    else:
        # 弹窗是独立页面，跟随系统
        if "prefers-color-scheme: dark" not in text:
            failures.append("%s: 缺少系统深色适配" % rel)

print("CSS 校验:", "全部通过" if not failures else "发现问题")
for item in failures:
    print(" -", item)
sys.exit(1 if failures else 0)
