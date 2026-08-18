from unittest.mock import patch
import pytest

from game.game import Game
from game.rules import GameRules


def test_game_x_wins():
    rules = GameRules.tic_tac_toe()
    game = Game(rules)

    game.make_move(0)
    game.make_move(3)
    game.make_move(1)
    game.make_move(4)
    game.make_move(2)

    assert game.winner == "X"
    assert game.game_over is True

def test_game_can_end_in_a_draw():
    rules = GameRules.tic_tac_toe()
    game = Game(rules)

    moves = [0, 1, 2, 4, 3, 5, 7, 6, 8]

    for move in moves:
        game.make_move(move)

    assert game.winner is None
    assert game.game_over is True

def test_plus_is_created_when_random_roll_is_low():
    rules = GameRules.tic_tac_toe_plus()
    game = Game(rules)

    with patch("game.game.random.random", return_value=0.1):
        game.make_move(0)

    assert game.board.cells[0] == "+"
    assert game.plus_count == 1

def test_plus_is_not_created_when_random_roll_is_high():
    rules = GameRules.tic_tac_toe_plus()
    game = Game(rules)

    with patch("game.game.random.random", return_value=0.5):
        game.make_move(0)

    assert game.board.cells[0] == "X"
    assert game.plus_count == 0

def test_game_cannot_create_more_than_three_plus_symbols():
    rules = GameRules.tic_tac_toe_plus()
    game = Game(rules)

    with patch("game.game.random.random", return_value=0.1):
        game.make_move(0)
        game.make_move(5)
        game.make_move(10)
        game.make_move(14)

    assert game.plus_count == 3
    assert game.board.cells[0] == "+"
    assert game.board.cells[5] == "+"
    assert game.board.cells[10] == "+"
    assert game.board.cells[14] != "+"

def test_win_length_cannot_exceed_board_size():
    with pytest.raises(
        ValueError,
        match="Win length cannot be greater than board size",
    ):
        GameRules(3, 4)