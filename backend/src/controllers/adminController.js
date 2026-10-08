const { Client } = require('pg');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/*
 * GET /api/v1/admin/users/pending-students
 */
async function getPendingStudents(req, res) {
    
    const client = getDbClient();

    try {
        await client.connect();

        const pending = await client.query(
            `SELECT id, first_name, last_name, email, created_at 
             FROM "users" 
             WHERE is_approved = false AND role = 'STUDENT'
             ORDER BY created_at DESC;`
        );

        const groups = await client.query('SELECT id, name FROM "groups" ORDER BY name ASC;');

        return res.json({ 
            status: 'success', 
            students: pending.rows,
            groups: groups.rows
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * GET /api/v1/admin/users/students
 */
async function getStudents(req, res) {
   
    const groupId = req.query.groupId ? req.query.groupId : null;
    const client = getDbClient();

    try {
        await client.connect();

        let query = `
            SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.created_at, g.name as group_name
            FROM "users" u
            LEFT JOIN "groups" g ON u.group_id = g.id
            WHERE u.is_approved = true AND u.role = 'STUDENT'
        `;

        const params = [];
        if (groupId && groupId != 'all') {
            params.push(groupId);
            query += ` AND u.group_id = $${params.length}`;
        }

        query += ` ORDER BY u.created_at DESC;`;

        const data = await client.query(query, params);

        return res.json({ 
            status: 'success', 
            students: data.rows
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * GET /api/v1/admin/users/teachers
 */
async function getTeachers(req, res) {
   
    const client = getDbClient();

    try {
        await client.connect();

        const data = await client.query(
            `SELECT id, first_name, last_name, email, role, created_at
            FROM "users"
            WHERE is_approved = true AND role = 'TEACHER'
            ORDER BY last_name ASC, first_name ASC;`
        );

        return res.json({ 
            status: 'success', 
            teachers: data.rows
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * PUT /api/v1/admin/users/approve
 */
async function approveStudent(req, res) {
   
    const { userId, groupId } = req.body;

    const client = getDbClient();

    try {
        await client.connect();

        await client.query(
            `UPDATE "users" 
             SET is_approved = true, group_id = $1 
             WHERE id = $2;`,
            [groupId || null, userId]
        );

        return res.json({ status: 'success', message: 'Студент успешно одобрен' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * PUT /api/v1/admin/users/role
 */
async function changeUserRole(req, res) {
    
    const { userId, role } = req.body;
    const currentUserId = req.user.id;

    const client = getDbClient();

    if (!['STUDENT', 'TEACHER'].includes(role)) {
        return res.status(400).json({ status: 'error', message: 'Некорректная роль' });
    }

    if (userId === currentUserId) {
        return res.status(400).json({ status: 'error', message: 'Вы не можете изменить роль самому себе' });
    }

    try {
        await client.connect();

        await client.query(
            'UPDATE "users" SET role = $1 WHERE id = $2;',
            [role, userId]
        );

        return res.json({ 
            status: 'success', 
            message: `Роль пользователя успешно изменена на ${role}` 
        });
    } catch (error) {
        console.error('Ошибка смены роли:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * GET /api/v1/admin/users/groups
 */
async function getGroups(req, res) {
 
    const client = getDbClient();

    try {
        await client.connect();

        const groups = await client.query(
            'SELECT id, name FROM "groups" ORDER BY name ASC;');

        return res.json({ 
            status: 'success', 
            groups: groups.rows
        });

    } catch(error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * POST /api/v1/admin/users/groups
 */
async function createGroup(req, res) {

    const { name } = req.body;
    const client = getDbClient();

    try {
        await client.connect();

        await client.query(
            'INSERT INTO "groups" (id, name) VALUES (gen_random_uuid()::text, $1);', [name]);

        return res.json({ status: 'success', message: 'Группа создана' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

/*
 * GET /api/v1/admin/users/gradebook
 */
async function getGradebook(req, res) {
    const { groupId } = req.query;
    const client = getDbClient();

    try {
        await client.connect();

        const labsRes = await client.query('SELECT id, title FROM "labs" ORDER BY "order" ASC;');
        const testsRes = await client.query('SELECT id, title FROM "tests" ORDER BY id ASC;');

        let studentQuery = `
            SELECT u.id, u.first_name, u.last_name, g.name as group_name
            FROM "users" u
            LEFT JOIN "groups" g ON u.group_id = g.id
            WHERE u.role = 'STUDENT' AND u.is_approved = true
        `;
        const params = [];

        if (groupId && groupId !== 'all') {
            studentQuery += ' AND u.group_id = $1';
            params.push(groupId);
        }

        studentQuery += ' ORDER BY g.name ASC, u.last_name ASC;';
        const studentsRes = await client.query(studentQuery, params);

        const rows = [];
        for (const student of studentsRes.rows) {
            const labGrades = await client.query(
                'SELECT lab_id, grade FROM "lab_submissions" WHERE user_id = $1;', 
                [student.id]
            );
            const testGrades = await client.query(
                'SELECT test_id, score_percent FROM "test_submissions" WHERE user_id = $1;', 
                [student.id]
            );

            const labsMap = {};
            labGrades.rows.forEach(r => labsMap[r.lab_id] = r.grade);

            const testsMap = {};
            testGrades.rows.forEach(r => testsMap[r.test_id] = r.score_percent);

            const allScores = [...Object.values(labsMap), ...Object.values(testsMap)];
            const avg = allScores.length > 0 
                ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) 
                : 0;

            rows.push({
                student_id: student.id,
                student_name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
                group_name: student.group_name,
                labs: labsMap,
                tests: testsMap,
                avg_grade: avg
            });
        }

        return res.json({
            status: 'success',
            data: {
                labs: labsRes.rows,
                tests: testsRes.rows,
                rows
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await client.end();
    }
}

module.exports = {
    getPendingStudents,
    getStudents,
    getTeachers,
    approveStudent,
    changeUserRole,
    getGroups, 
    createGroup,
    getGradebook
};