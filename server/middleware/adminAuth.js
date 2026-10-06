const adminAuth = async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: 'Ошибка при проверке прав администратора' });
    }
};

module.exports = adminAuth; 