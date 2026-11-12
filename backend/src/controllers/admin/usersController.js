const { Client } = require('pg');
const { sendUserNotification } = require('../../services/notification');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

function getDbClient() {
    return new Client({ connectionString: process.env.DATABASE_URL });
}

/*
 * GET /api/v1/admin/users/pending-students
 */
const getPendingStudents = catchAsync(async (req, res) => {
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
    } finally {
        await client.end();
    }
});

/*
 * GET /api/v1/admin/users/students
 */
const getStudents = catchAsync(async (req, res) => {
    const groupId = req.query.groupId ? req.query.groupId : null;
    const client = getDbClient();

    try {
        await client.connect();

        let query = `
            SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.created_at, g.id as group_id, g.name as group_name
            FROM "users" u
            LEFT JOIN "groups" g ON u.group_id = g.id
            WHERE u.is_approved = true AND u.role = 'STUDENT'
        `;

        const params = [];
        if (groupId && groupId !== 'all') {
            params.push(groupId);
            query += ` AND u.group_id = $${params.length}`;
        }

        query += ` ORDER BY u.created_at DESC;`;

        const data = await client.query(query, params);

        return res.json({
            status: 'success',
            students: data.rows
        });
    } finally {
        await client.end();
    }
});

/*
 * GET /api/v1/admin/users/teachers
 */
const getTeachers = catchAsync(async (req, res) => {
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
    } finally {
        await client.end();
    }
});

/*
 * PUT /api/v1/admin/users/approve
 */
const approveStudent = catchAsync(async (req, res) => {
    const { userId, groupId, groupName } = req.body;

    if (!userId) {
        throw new AppError('Не указан ID пользователя', 400, 'MISSING_USER_ID');
    }

    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query(
            `UPDATE "users" 
             SET is_approved = true, group_id = $1 
             WHERE id = $2;`,
            [groupId || null, userId]
        );

        if (result.rowCount === 0) {
            throw new AppError('Пользователь не найден', 404, 'USER_NOT_FOUND');
        }
    } finally {
        await client.end();
    }

    try {
        await sendUserNotification({
            userId,
            title: 'Обновление учебной группы',
            message: `Вас назначили в учебную группу: ${groupName || 'без группы'}`,
            type: 'GROUP_CHANGE'
        });
    } catch (notifyErr) {
        console.error('[WARN] Не удалось отправить уведомление об одобрении студента:', notifyErr.message);
    }

    return res.json({ status: 'success', message: 'Студент успешно одобрен' });
});

/*
 * PUT /api/v1/admin/users/role
 */
const changeUserRole = catchAsync(async (req, res) => {
    const { userId, role } = req.body;
    const currentUserId = req.user.id;

    if (!userId) {
        throw new AppError('Не указан ID пользователя', 400, 'MISSING_USER_ID');
    }

    if (!['STUDENT', 'TEACHER'].includes(role)) {
        throw new AppError('Некорректная роль', 400, 'INVALID_ROLE');
    }

    if (userId === currentUserId) {
        throw new AppError('Вы не можете изменить роль самому себе', 400, 'SELF_ROLE_CHANGE_FORBIDDEN');
    }

    const client = getDbClient();

    try {
        await client.connect();

        const result = await client.query(
            'UPDATE "users" SET role = $1 WHERE id = $2;',
            [role, userId]
        );

        if (result.rowCount === 0) {
            throw new AppError('Пользователь не найден', 404, 'USER_NOT_FOUND');
        }
    } finally {
        await client.end();
    }

    try {
        await sendUserNotification({
            userId,
            title: 'Обновление прав доступа',
            message: `Вам назначена новая роль на платформе: ${role}`,
            type: 'ROLE_CHANGE'
        });
    } catch (notifyErr) {
        console.error('[WARN] Не удалось отправить уведомление об изменении роли:', notifyErr.message);
    }

    return res.json({
        status: 'success',
        message: `Роль пользователя успешно изменена на ${role}`
    });
});

/*
 * GET /api/v1/admin/users/groups
 */
const getGroups = catchAsync(async (req, res) => {
    const client = getDbClient();

    try {
        await client.connect();

        const groups = await client.query('SELECT id, name FROM "groups" ORDER BY name ASC;');

        return res.json({
            status: 'success',
            groups: groups.rows
        });
    } finally {
        await client.end();
    }
});

/*
 * POST /api/v1/admin/users/groups
 */
const createGroup = catchAsync(async (req, res) => {
    const { name } = req.body;

    if (!name || !String(name).trim()) {
        throw new AppError('Укажите название учебной группы', 400, 'MISSING_GROUP_NAME');
    }

    const client = getDbClient();

    try {
        await client.connect();

        await client.query(
            'INSERT INTO "groups" (id, name) VALUES (gen_random_uuid()::text, $1);',
            [String(name).trim()]
        );

        return res.status(201).json({ status: 'success', message: 'Группа создана' });
    } finally {
        await client.end();
    }
});

/*
 * PUT /api/v1/admin/users/group
 */
const updateUserGroup = catchAsync(async (req, res) => {
    const { userId, groupId, groupName } = req.body;

    if (!userId) {
        throw new AppError('Не указан ID пользователя', 400, 'MISSING_USER_ID');
    }

    const client = getDbClient();

    try {
        await client.connect();

        const targetGroupId = groupId && groupId !== 'unassigned' && groupId !== '' ? groupId : null;

        const result = await client.query(`
            UPDATE "users"
            SET group_id = $1
            WHERE id = $2;
        `, [targetGroupId, userId]);

        if (result.rowCount === 0) {
            throw new AppError('Пользователь не найден', 404, 'USER_NOT_FOUND');
        }
    } finally {
        await client.end();
    }

    try {
        await sendUserNotification({
            userId,
            title: 'Обновление учебной группы',
            message: `Вас назначили в учебную группу: ${groupName || 'без группы'}`,
            type: 'GROUP_CHANGE'
        });
    } catch (notifyErr) {
        console.error('[WARN] Не удалось отправить уведомление об изменении группы:', notifyErr.message);
    }

    return res.json({
        status: 'success',
        message: 'Учебная группа успешно обновлена'
    });
});

/*
 * GET /api/v1/admin/users/gradebook
 */
const getGradebook = catchAsync(async (req, res) => {
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
            labGrades.rows.forEach(r => { labsMap[r.lab_id] = r.grade; });

            const testsMap = {};
            testGrades.rows.forEach(r => { testsMap[r.test_id] = r.score_percent; });

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
    } finally {
        await client.end();
    }
});

module.exports = {
    getPendingStudents,
    getStudents,
    getTeachers,
    approveStudent,
    changeUserRole,
    getGroups,
    createGroup,
    updateUserGroup,
    getGradebook
};