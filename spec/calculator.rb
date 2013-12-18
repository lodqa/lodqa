class Calculator
    # Add two numbers.  Assumption: only two numbers!
    # Addition of more than two numbers is not supported.
    def add(number1, number2)
       sum = number1 + number2
       return sum 
    end

    # Subtract second number from first number.
    def subtract(number1, number2)
        difference = number1 - number2
        return difference 
    end

    # Do multiplication.  Assumption: only two numbers!
    def multiply(number1, number2)
        product = number1 * number2
        return product
    end

    # Do division.  Need to support:
    # * Division by real numbers
    # * Robust to attempted division by zero
    def divide(numerator, denominator)
        # check to see if denominator is zero--return 0 if so, I guess.
      if denominator == 0
            return 0
        end

      # denominator wasn't zero, so do it
      quotient = numerator / denominator.to_f
      return quotient
    end  
end # close class definition
