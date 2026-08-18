class GameRules:
    def __init__(
        self,
        board_size,
        win_length,
        plus_enabled=False,
        plus_probability=1 / 6,
        max_plus=3,
    ):
        self.board_size = board_size
        self.win_length = win_length
        self.plus_enabled = plus_enabled
        self.plus_probability = plus_probability
        self.max_plus = max_plus

        if win_length > board_size:
            raise ValueError("Win length cannot be greater than board size")

    @classmethod
    def tic_tac_toe(cls):
        return cls(
            board_size=3,
            win_length=3,
        )

    @classmethod
    def tic_tac_toe_plus(cls):
        return cls(
            board_size=4,
            win_length=4,
            plus_enabled=True,
        )