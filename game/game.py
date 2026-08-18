import random

from game.board import Board


class Game:
    def __init__(self, rules):
        self.rules = rules
        self.board = Board(rules.board_size)
        self.current_player = "X"
        self.winner = None
        self.game_over = False
        self.plus_count = 0

    def make_move(self, position):
        if self.game_over:
            raise ValueError("The game is already over")

        symbol = self.current_player

        if self.should_use_plus():
            symbol = "+"

        self.board.make_move(position, symbol)

        if symbol == "+":
            self.plus_count += 1

        winner = self.board.get_winner()

        if winner is not None:
            self.winner = winner
            self.game_over = True
        elif self.board.is_full():
            self.game_over = True
        else:
            self.switch_player()

    def switch_player(self):
        if self.current_player == "X":
            self.current_player = "O"
        else:
            self.current_player = "X"

    def can_use_plus(self):
        return (
            self.rules.plus_enabled
            and self.plus_count < self.rules.max_plus
        )
    
    def should_use_plus(self):
        if not self.can_use_plus():
            return False

        return random.random() < self.rules.plus_probability