import random
from game.board import Board


class UltimateGame:
    def __init__(self, board_size):
        self.board_size = board_size
        self.meta_board = Board(board_size)

        self.local_boards = [
            Board(board_size)
            for _ in range(board_size * board_size)
        ]

        self.completed_boards = [None] * (board_size * board_size)

        self.current_player = "X"
        self.winner = None
        self.game_over = False
        self.target_board = None
        self.plus_count = 0
        self.max_plus = 3

    def parse_move(self, move):
        try:
            board_number, cell_number = move.split(".")
            board_number = int(board_number)
            cell_number = int(cell_number)
        except (ValueError, AttributeError):
            raise ValueError("Move must be in the format board.cell")

        board_index = board_number - 1
        cell_index = cell_number - 1

        max_position = self.board_size * self.board_size

        if not 0 <= board_index < max_position:
            raise ValueError("Board number is out of range")

        if not 0 <= cell_index < max_position:
            raise ValueError("Cell number is out of range")

        return board_index, cell_index

    def make_move(self, move):
        if self.game_over:
            raise ValueError("The game is already over")

        board_index, cell_index = self.parse_move(move)

        if self.completed_boards[board_index] is not None:
            raise ValueError("This board has already been completed")

        if self.target_board is not None:
            if self.completed_boards[self.target_board] is None:
                if board_index != self.target_board:
                    raise ValueError("You must play in the target board")
            elif board_index not in self.get_available_boards():
                raise ValueError("You must play in an available board")

        board = self.local_boards[board_index]

        board.make_move(cell_index, self.current_player)

        self.update_local_board(board_index)

        if not self.game_over:
            self.target_board = cell_index
            self.switch_player()

    def switch_player(self):
        if self.current_player == "X":
            self.current_player = "O"
        else:
            self.current_player = "X"

    def update_local_board(self, board_index):
        board = self.local_boards[board_index]

        winner = board.get_winner()

        if winner is not None:
            self.completed_boards[board_index] = winner
            self.meta_board.make_move(board_index, winner)
            self.check_winner()


        elif board.is_full():
            self.completed_boards[board_index] = "D"

        self.check_draw()

    def get_available_boards(self):
        return [
            index
            for index, status in enumerate(self.completed_boards)
            if status is None
        ]

    def check_winner(self):
        winner = self.meta_board.get_winner()

        if winner is not None:
            self.winner = winner
            self.game_over = True

    def check_draw(self):
        if not self.get_available_boards() and self.winner is None:
            self.game_over = True

    def get_move_symbol(self):
        if self.board_size == 4 and self.plus_count < self.max_plus:
            if random.randint(1, 6) == 1:
                self.plus_count += 1
                return "+"

        return self.current_player