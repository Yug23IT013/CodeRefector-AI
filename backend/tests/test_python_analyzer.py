import pytest
from app.services.analyzer.python_analyzer import PythonAnalyzer


@pytest.fixture
def analyzer():
    return PythonAnalyzer()


def test_sec001_eval_exec(analyzer):
    code = """
def run_code(user_input):
    eval(user_input)
    exec("print('hello')")
"""
    findings = analyzer.analyze("test.py", code)
    eval_findings = [f for f in findings if f.rule_id == "SEC001"]
    assert len(eval_findings) == 2
    assert eval_findings[0].severity == "critical"
    assert eval_findings[0].line_number == 3
    assert eval_findings[1].line_number == 4


def test_sec002_hardcoded_secrets(analyzer):
    code = """
api_key = "dummy_mock_secret_value_12345"
password = "SuperSecretPassword123!"
"""
    findings = analyzer.analyze("test.py", code)
    secret_findings = [f for f in findings if f.rule_id == "SEC002"]
    assert len(secret_findings) >= 1
    assert any(f.line_number == 2 for f in secret_findings)


def test_sec003_sql_injection(analyzer):
    code = """
def get_user(cursor, user_id):
    cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
    cursor.execute("SELECT * FROM users WHERE id = %s" % user_id)
    cursor.execute("SELECT * FROM users WHERE id = {}".format(user_id))
"""
    findings = analyzer.analyze("test.py", code)
    sql_findings = [f for f in findings if f.rule_id == "SEC003"]
    assert len(sql_findings) == 3


def test_sec004_insecure_deserialization(analyzer):
    code = """
import pickle
import yaml

def parse(data):
    obj = pickle.loads(data)
    y = yaml.load(data)
"""
    findings = analyzer.analyze("test.py", code)
    pickle_findings = [f for f in findings if f.rule_id == "SEC004"]
    assert len(pickle_findings) == 2


def test_bug001_bare_except(analyzer):
    code = """
def risky():
    try:
        do_something()
    except:
        pass
"""
    findings = analyzer.analyze("test.py", code)
    bare_findings = [f for f in findings if f.rule_id == "BUG001"]
    assert len(bare_findings) == 1
    assert bare_findings[0].line_number == 5


def test_bug002_mutable_default_args(analyzer):
    code = """
def append_to(element, target=[]):
    target.append(element)
    return target
"""
    findings = analyzer.analyze("test.py", code)
    mutable_findings = [f for f in findings if f.rule_id == "BUG002"]
    assert len(mutable_findings) == 1
    assert mutable_findings[0].line_number == 2


def test_bug003_none_comparison(analyzer):
    code = """
def is_empty(val):
    if val == None:
        return True
    if val != None:
        return False
"""
    findings = analyzer.analyze("test.py", code)
    cmp_findings = [f for f in findings if f.rule_id == "BUG003"]
    assert len(cmp_findings) == 2


def test_bug004_generic_raise(analyzer):
    code = """
def validate(x):
    if x < 0:
        raise Exception("Must be positive")
"""
    findings = analyzer.analyze("test.py", code)
    raise_findings = [f for f in findings if f.rule_id == "BUG004"]
    assert len(raise_findings) == 1


def test_perf001_cyclomatic_complexity(analyzer):
    code = """
def complex_fn(a, b, c, d, e, f, g, h, i, j):
    if a:
        if b:
            if c:
                if d:
                    if e:
                        if f:
                            if g:
                                if h:
                                    if i:
                                        if j:
                                            return True
    return False
"""
    findings = analyzer.analyze("test.py", code)
    perf_findings = [f for f in findings if f.rule_id == "PERF001"]
    assert len(perf_findings) == 1
    assert "complexity" in perf_findings[0].message.lower()


def test_perf002_unused_import(analyzer):
    code = """
import sys
import os

print(os.getcwd())
"""
    findings = analyzer.analyze("test.py", code)
    unused_findings = [f for f in findings if f.rule_id == "PERF002"]
    assert len(unused_findings) == 1
    assert "sys" in unused_findings[0].message


def test_clean_python_code(analyzer):
    code = """
import math

def calculate_circle_area(radius: float) -> float:
    if radius < 0:
        raise ValueError("Radius cannot be negative")
    return math.pi * (radius ** 2)
"""
    findings = analyzer.analyze("clean.py", code)
    assert len(findings) == 0
