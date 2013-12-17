#require "calculator"
require File.expand_path('../calculator.rb', __FILE__)

describe "Calculator", "basic operations" do
    it "should support addition" do
        c = Calculator.new
        c.add(1, 2).should == 3
    end
    it "should support subtraction" do
        c = Calculator.new
        c.subtract(4, 3).should == 1
    end
    it "should support multiplication" do
        c = Calculator.new
        c.multiply(2, 3).should == 6
    end
    it "should support division" do
        c = Calculator.new
        c.divide(2, 1).should == 2
    end
    it "should not crash if dividing by zero" do
       c = Calculator.new
       c.divide(2, 0).should == 0
    end
    it "should support real numbers" do
       c = Calculator.new
       c.divide(1, 2).should == 0.5
       c.divide(1, 2.0).should == 0.5 
    end   
end
