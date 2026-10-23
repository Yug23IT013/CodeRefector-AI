import pytest
from app.services.analyzer.js_analyzer import JavaScriptAnalyzer


@pytest.fixture
def js_analyzer():
    return JavaScriptAnalyzer()


def test_js_eval_detection(js_analyzer):
    code = """
    function calculate(str) {
        return eval(str);
    }
    """
    findings = js_analyzer.analyze("calc.js", code)
    eval_findings = [f for f in findings if f.rule_id == "JS_SEC001"]
    assert len(eval_findings) >= 1
    assert eval_findings[0].severity == "critical"
    assert "eval" in eval_findings[0].message.lower()


def test_js_function_constructor(js_analyzer):
    code = """
    const dynamicFn = new Function('a', 'b', 'return a + b');
    """
    findings = js_analyzer.analyze("dynamic.js", code)
    fn_findings = [f for f in findings if f.rule_id in ("JS_SEC002", "JS_SEC001")]
    assert len(fn_findings) >= 1


def test_js_document_write(js_analyzer):
    code = """
    function render(content) {
        document.write("<div>" + content + "</div>");
    }
    """
    findings = js_analyzer.analyze("render.js", code)
    dw_findings = [f for f in findings if f.rule_id == "JS_SEC003"]
    assert len(dw_findings) >= 1
    assert dw_findings[0].severity == "high"


def test_js_inner_html(js_analyzer):
    code = """
    function updateDOM(userHtml) {
        const el = document.getElementById('target');
        el.innerHTML = userHtml;
    }
    """
    findings = js_analyzer.analyze("dom.ts", code)
    html_findings = [f for f in findings if f.rule_id == "JS_SEC004"]
    assert len(html_findings) >= 1
    assert html_findings[0].severity == "high"


def test_js_debugger_statement(js_analyzer):
    code = """
    function debugMe() {
        const a = 1;
        debugger;
        return a * 2;
    }
    """
    findings = js_analyzer.analyze("debug.js", code)
    dbg_findings = [f for f in findings if f.rule_id == "JS_BUG001"]
    assert len(dbg_findings) >= 1
    assert dbg_findings[0].severity == "low"


def test_clean_typescript_tsx_code(js_analyzer):
    code = """
    import React, { useState } from 'react';

    interface Props {
        title: string;
        count?: number;
    }

    export const Counter: React.FC<Props> = ({ title, count = 0 }) => {
        const [current, setCurrent] = useState<number>(count);
        return (
            <div className="counter-card">
                <h1>{title}</h1>
                <p>Count: {current}</p>
                <button onClick={() => setCurrent(prev => prev + 1)}>Increment</button>
            </div>
        );
    };
    """
    findings = js_analyzer.analyze("Counter.tsx", code)
    assert len(findings) == 0


def test_regex_fallback_analysis(js_analyzer):
    code = """
    const x = eval(payload);
    el.innerHTML = "<b>test</b>";
    debugger;
    """
    findings = js_analyzer._regex_fallback("fallback.js", code)
    rule_ids = {f.rule_id for f in findings}
    assert "JS_SEC001" in rule_ids
    assert "JS_SEC004" in rule_ids
    assert "JS_BUG001" in rule_ids
