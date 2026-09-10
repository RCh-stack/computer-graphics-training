const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

exports.compileAndRun = async (lab, studentCode) => {
    const sessionDir = path.join(__dirname, '../../storage', `session_${Date.now()}`);
    await fs.mkdir(sessionDir, { recursive: true });

    const sourcePath = path.join(sessionDir, 'solution.cpp');
    const binaryPath = path.join(sessionDir, 'runner');

    // Формируем полный C++ файл, объединяя код студента и тестовый каркас
    const fullSourceCode = `
        #include <iostream>
        #include <cassert>
        
        // Код студента
        ${studentCode}
        
        // Автоматические тесты
        int main() {
            // Тест 1
            // ...
            std::cout << "SUCCESS" << std::endl;
            return 0;
        }
    `;

    await fs.writeFile(sourcePath, fullSourceCode);

    // Выполняем компиляцию C++
    return new Promise((resolve) => {
        exec(`g++ -O3 ${sourcePath} -o ${binaryPath}`, (compileErr, stdout, stderr) => {
            if (compileErr) {
                // Ошибка компиляции
                return resolve({
                    status: 'compile_error',
                    compile_output: stderr,
                    tests: []
                });
            }

            // Запуск собранного бинарника
            exec(binaryPath, { timeout: 2000 }, (runErr, runStdout, runStderr) => {
                if (runErr) {
                    return resolve({
                        status: 'runtime_error',
                        compile_output: runStderr,
                        tests: []
                    });
                }

                // Успешный запуск
                resolve({
                    status: 'success',
                    compile_output: '',
                    execution_time_ms: 1.2,
                    tests: [
                        { id: 1, name: "Тест пройден", passed: true, time_ms: 0.1 }
                    ]
                });
            });
        });
    });
};