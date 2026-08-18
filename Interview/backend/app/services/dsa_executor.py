import sys
import os
import json
import time
import tempfile
import subprocess
import logging

logger = logging.getLogger(__name__)


class DSAExecutor:
    """Safely executes candidate code in isolated subprocesses against test cases."""

    def __init__(self, timeout_sec: float = 3.0):
        self.timeout_sec = timeout_sec

    def execute_test_cases(self, language: str, code: str, test_cases: list[dict]) -> dict:
        """
        Execute code against a list of test cases.

        Args:
            language: 'python' or 'javascript'
            code: Candidate code string
            test_cases: List of dicts with 'input' and 'expected_output'

        Returns:
            Dict containing passed_count, total_count, test_results
        """
        results = []
        passed_count = 0
        total_count = len(test_cases)

        for tc in test_cases:
            inp = str(tc.get("input", ""))
            expected = str(tc.get("expected_output", "")).strip()
            
            res = self._run_single_case(language, code, inp, expected)
            if res["passed"]:
                passed_count += 1
            results.append(res)

        return {
            "passed_count": passed_count,
            "total_count": total_count,
            "test_results": results,
        }

    def _run_single_case(self, language: str, code: str, test_input: str, expected_output: str) -> dict:
        start_time = time.time()
        
        if language.lower() in ("python", "python3", "py"):
            return self._run_python(code, test_input, expected_output, start_time)
        elif language.lower() in ("javascript", "js", "node"):
            return self._run_javascript(code, test_input, expected_output, start_time)
        else:
            return {
                "input": test_input,
                "expected_output": expected_output,
                "actual_output": "",
                "passed": False,
                "error": f"Unsupported language: {language}",
                "execution_time_ms": 0.0,
            }

    def _run_python(self, code: str, test_input: str, expected_output: str, start_time: float) -> dict:
        # Construct wrapper script that imports/defines solution and prints JSON output
        harness = f"""
import json, sys, ast

{code}

def __run_test():
    try:
        # Find global function candidate (prefer 'solution' or first user defined function)
        target_fn = None
        if 'solution' in globals():
            target_fn = globals()['solution']
        else:
            funcs = [v for k, v in globals().items() if callable(v) and not k.startswith('__')]
            if funcs:
                target_fn = funcs[-1]

        if not target_fn:
            print(json.dumps({{"error": "No function found to execute"}}))
            return

        # Parse test inputs
        inp_str = {json.dumps(test_input)}
        try:
            # Handle comma separated or single JSON value
            if inp_str.startswith("(") and inp_str.endswith(")"):
                args = ast.literal_eval(inp_str)
            else:
                args = ast.literal_eval(f"({inp_str},)")
        except Exception:
            args = (inp_str,)

        if not isinstance(args, tuple):
            args = (args,)

        res = target_fn(*args)
        print(json.dumps({{"result": res}}))
    except Exception as e:
        print(json.dumps({{"error": str(e)}}))

if __name__ == '__main__':
    __run_test()
"""
        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
            f.write(harness)
            temp_path = f.name

        try:
            proc = subprocess.run(
                [sys.executable, temp_path],
                capture_output=True,
                text=True,
                timeout=self.timeout_sec,
            )
            exec_time = round((time.time() - start_time) * 1000, 2)
            
            if proc.returncode != 0:
                return {
                    "input": test_input,
                    "expected_output": expected_output,
                    "actual_output": "",
                    "passed": False,
                    "error": proc.stderr.strip() or "Execution Error",
                    "execution_time_ms": exec_time,
                }

            stdout = proc.stdout.strip()
            parsed = {}
            if stdout:
                try:
                    # Look for last JSON line
                    last_line = stdout.splitlines()[-1]
                    parsed = json.loads(last_line)
                except Exception:
                    parsed = {"result": stdout}

            if "error" in parsed:
                return {
                    "input": test_input,
                    "expected_output": expected_output,
                    "actual_output": "",
                    "passed": False,
                    "error": parsed["error"],
                    "execution_time_ms": exec_time,
                }

            actual = json.dumps(parsed.get("result")) if not isinstance(parsed.get("result"), str) else parsed.get("result")
            passed = self._compare_outputs(actual, expected_output)

            return {
                "input": test_input,
                "expected_output": expected_output,
                "actual_output": str(actual),
                "passed": passed,
                "error": None,
                "execution_time_ms": exec_time,
            }
        except subprocess.TimeoutExpired:
            return {
                "input": test_input,
                "expected_output": expected_output,
                "actual_output": "",
                "passed": False,
                "error": f"Time Limit Exceeded ({self.timeout_sec}s)",
                "execution_time_ms": self.timeout_sec * 1000,
            }
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def _run_javascript(self, code: str, test_input: str, expected_output: str, start_time: float) -> dict:
        harness = f"""
{code}

try {{
    let fn = typeof solution === 'function' ? solution : null;
    if (!fn) {{
        // find first function in scope
        fn = Object.values(global).find(v => typeof v === 'function');
    }}
    
    let rawInput = {json.dumps(test_input)};
    let args;
    try {{
        args = JSON.parse(`[${{rawInput}}]`);
    }} catch (e) {{
        args = [rawInput];
    }}
    
    let res = fn ? fn(...args) : null;
    console.log(JSON.stringify({{ result: res }}));
}} catch (err) {{
    console.log(JSON.stringify({{ error: err.message }}));
}}
"""
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
            f.write(harness)
            temp_path = f.name

        try:
            node_binary = "node"
            proc = subprocess.run(
                [node_binary, temp_path],
                capture_output=True,
                text=True,
                timeout=self.timeout_sec,
            )
            exec_time = round((time.time() - start_time) * 1000, 2)
            
            if proc.returncode != 0:
                return {
                    "input": test_input,
                    "expected_output": expected_output,
                    "actual_output": "",
                    "passed": False,
                    "error": proc.stderr.strip() or "Execution Error",
                    "execution_time_ms": exec_time,
                }

            stdout = proc.stdout.strip()
            parsed = {}
            if stdout:
                try:
                    last_line = stdout.splitlines()[-1]
                    parsed = json.loads(last_line)
                except Exception:
                    parsed = {"result": stdout}

            if "error" in parsed:
                return {
                    "input": test_input,
                    "expected_output": expected_output,
                    "actual_output": "",
                    "passed": False,
                    "error": parsed["error"],
                    "execution_time_ms": exec_time,
                }

            actual = json.dumps(parsed.get("result")) if not isinstance(parsed.get("result"), str) else parsed.get("result")
            passed = self._compare_outputs(actual, expected_output)

            return {
                "input": test_input,
                "expected_output": expected_output,
                "actual_output": str(actual),
                "passed": passed,
                "error": None,
                "execution_time_ms": exec_time,
            }
        except Exception as e:
            return {
                "input": test_input,
                "expected_output": expected_output,
                "actual_output": "",
                "passed": False,
                "error": str(e),
                "execution_time_ms": 0.0,
            }
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def _compare_outputs(self, actual: str, expected: str) -> bool:
        """Compare actual output string to expected output string with whitespace/JSON tolerance."""
        a = str(actual).strip()
        e = str(expected).strip()
        if a == e:
            return True
        try:
            return json.loads(a) == json.loads(e)
        except Exception:
            return False


dsa_executor = DSAExecutor()
